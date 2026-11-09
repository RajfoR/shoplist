# Kontrakt API — Shoplist

Jedno źródło prawdy dla backendu, weba i mobile'a. Zmiana kontraktu = PR, który
zatwierdzają obie osoby. Typy TS generujemy z OpenAPI (`pnpm gen:api`), więc REST
nie wymaga ręcznego przepisywania. Eventy WS są opisane tutaj i w
`packages/api-client/src/events.ts`.

## Zasady

1. **Serwer jest źródłem prawdy.** Mutacje idą przez REST. WebSocket służy tylko
   do odbierania zmian (server → client) plus ping/pong.
2. **Optimistic update na kliencie.** Klient zmienia stan lokalnie od razu,
   a potem nadpisuje go odpowiedzią REST.
3. **Wersjonowanie elementów.** Każda zmiana `item` podbija `version`. Klient
   aplikuje event tylko wtedy, gdy `event.data.version > local.version`.
   Dzięki temu własne echo (event po własnym PATCH) jest idempotentne,
   a kolejność dostarczenia nie psuje stanu.
4. **Konflikty: last-write-wins** w kolejności commitów w bazie. Bez 409, bez merge'a.
5. **Id produktu generuje klient** (UUID v4 w `POST /lists/{id}/items`).
   Optimistic item, odpowiedź REST i event `item.created` mają to samo `id`,
   więc nie ma duplikatów ani podmiany tymczasowego id. 409 przy create
   oznacza, że produkt już istnieje (np. retry), a klient robi resync.
6. **(Re)connect = snapshot.** Po każdym `ready` z WS klient robi
   `GET /lists/{id}` i podmienia cały stan. Eventy, które przyszły w trakcie
   pobierania snapshotu, aplikuje po nim (reguła z pkt 3 rozwiązuje duplikaty).
7. **Brak dostępu = 404**, nie 403. Nie zdradzamy, że lista istnieje.
   Wyjątek: usuwanie listy przez członka, który nie jest właścicielem → 403.

## Model danych

```
users          id uuid PK | display_name varchar(40) | is_guest bool | created_at
lists          id uuid PK | name varchar(80) | owner_id → users | share_token varchar(64) UNIQUE
               | created_at | updated_at
list_members   (list_id → lists, user_id → users) PK | joined_at
items          id uuid PK | list_id → lists | name varchar(120) | quantity varchar(40) NULL
               | checked bool | version int | created_by → users NULL | created_at | updated_at
```

Usunięcie listy kaskadowo usuwa członkostwa i produkty.

## Auth

Gość podaje nick i dostaje JWT (HS256, `sub` = user id, ważny 30 dni).
REST: nagłówek `Authorization: Bearer <token>`.

## REST

| Metoda | Ścieżka | Body | Odpowiedź | Event WS |
|---|---|---|---|---|
| POST | `/auth/guest` | `{display_name}` | 201 `{access_token, token_type, user}` | — |
| GET | `/me` | — | `User` | — |
| GET | `/lists` | — | `List[]` (moje, najnowsze pierwsze) | — |
| POST | `/lists` | `{name}` | 201 `ListDetail` | — |
| GET | `/lists/{id}` | — | `ListDetail` (z `items`, `members`, `share_token`) | — |
| PATCH | `/lists/{id}` | `{name}` | `List` | `list.updated` |
| DELETE | `/lists/{id}` | — | 204 (tylko właściciel) | `list.deleted` |
| POST | `/lists/join` | `{share_token}` | `ListDetail` | `member.joined` |
| POST | `/lists/{id}/items` | `{id?, name, quantity?}` | 201 `Item`, 409 gdy `id` zajęte | `item.created` |
| PATCH | `/items/{id}` | `{name?, quantity?, checked?}` | `Item` | `item.updated` |
| DELETE | `/items/{id}` | — | 204 | `item.deleted` |
| GET | `/health` | — | `{status: "ok"}` | — |

Pełne schematy: `http://localhost:8000/docs`.

## WebSocket

`ws(s)://<host>/ws/lists/{list_id}`

### Handshake

Token **nie** idzie w URL-u, bo URL-e lądują w logach proxy i historii.
Zamiast tego pierwsza wiadomość po połączeniu musi być autoryzacją:

```
client → {"type": "auth", "token": "<jwt>"}
server → {"type": "ready", "list_id": "...", "user_id": "..."}
```

Brak `auth` w ciągu 5 s albo zły token → zamknięcie z kodem **4401**.
Użytkownik nie jest członkiem listy → **4404**.

### Keepalive

```
client → {"type": "ping"}
server → {"type": "pong"}
```

Klient wysyła ping co ~25 s, bo reverse proxy zabija bezczynne połączenia.

### Eventy (server → client)

Wspólna koperta:

```json
{
  "type": "item.updated",
  "list_id": "uuid",
  "actor_id": "uuid",
  "ts": "2026-11-08T12:00:00Z",
  "data": { }
}
```

| `type` | `data` |
|---|---|
| `item.created` | `Item` |
| `item.updated` | `Item` |
| `item.deleted` | `{id}` |
| `list.updated` | `List` |
| `list.deleted` | `{id}` — klient wychodzi z ekranu listy |
| `member.joined` | `User` |

Zasada dla klienta: eventy, których nie zna, ignoruje (pozwala to dodawać nowe
typy bez łamania starszych buildów APK).

## Kody zamknięcia WS

| Kod | Znaczenie | Reakcja klienta |
|---|---|---|
| 1000 | normalne zamknięcie | nic |
| 4401 | brak/zły token | wyloguj, nie reconnectuj |
| 4404 | brak dostępu do listy | wróć do listy list, nie reconnectuj |
| inne | sieć, restart serwera | reconnect z backoffem (1 s, 2 s, 4 s… max 30 s) |
