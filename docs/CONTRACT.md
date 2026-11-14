## WebSocket

`ws(s)://<host>/ws/lists/{list_id}`

### Handshake

Token **nie** idzie w URL-u, bo URL-e lądują w logach proxy i historii.
Zamiast tego pierwsza wiadomość po połączeniu musi być autoryzacją:

```
client → {"type": "auth", "token": "<jwt>"}
server → {"type": "ready", "list_id": "...", "user_id": "...", "online": [User, ...]}
```

`online` to osoby, które mają teraz otwartą tę listę (każda raz, także ty).
Dalsze zmiany przychodzą jako `presence.joined` / `presence.left`.

Brak `auth` w ciągu 5 s albo zły token → zamknięcie z kodem **4401**.
Użytkownik nie jest członkiem listy → **4404**.

### Keepalive

```
client → {"type": "ping"}
server → {"type": "pong"}
```

Klient wysyła ping co ~25 s, bo reverse proxy zabija bezczynne połączenia.
Serwer zamyka połączenie kodem **4408**, gdy przez 90 s nie dostanie żadnej
wiadomości (martwe połączenie, np. telefon stracił zasięg). Klient robi reconnect.

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
| `member.joined` | `User` — nowa osoba na liście (dołączyła kodem) |
| `presence.joined` | `User` — ktoś otworzył listę (pierwsze połączenie tej osoby) |
| `presence.left` | `User` — ktoś zamknął listę (ostatnie połączenie tej osoby) |

`member.*` dotyczy członkostwa (zapisane w bazie), `presence.*` tego, kto jest
teraz online (tylko w pamięci serwera). Osoba z telefonem i laptopem naraz
jest online raz: `presence.left` przychodzi dopiero po zamknięciu obu.

Zasada dla klienta: eventy, których nie zna, ignoruje (pozwala to dodawać nowe
typy bez łamania starszych buildów APK).

## Kody zamknięcia WS

| Kod | Znaczenie | Reakcja klienta |
|---|---|---|
| 1000 | normalne zamknięcie | nic |
| 4401 | brak/zły token | wyloguj, nie reconnectuj |
| 4404 | brak dostępu do listy | wróć do listy list, nie reconnectuj |
| 4408 | brak wiadomości przez 90 s | reconnect (jak „inne”) |
| inne | sieć, restart serwera | reconnect z backoffem (1 s, 2 s, 4 s… max 30 s) |