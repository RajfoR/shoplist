# Shoplist — współdzielone listy zakupów w czasie rzeczywistym

Monorepo:

- `backend/`: FastAPI + PostgreSQL
- `apps/web`: React + Vite + Storybook (Jest)
- `apps/mobile`: Expo, Android
- `packages/api-client`: typy z OpenAPI, klient WebSocket, reducer eventów
- `packages/core`: hooki React wspólne dla weba i Androida (auth, listy, real-time, optimistic update)

Kontrakt API i protokół WebSocket: **[docs/CONTRACT.md](docs/CONTRACT.md)**.

## Start lokalny

```bash
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build
```

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

## Produkcja

VPS z Caddym (HTTPS, `wss://`), obrazy backendu i weba w GHCR, deploy po każdym
zielonym pushu na `main`. Storybook jest publikowany razem z aplikacją pod
`https://<WEB_DOMAIN>/storybook/`. Setup i operacje: **[deploy/README.md](deploy/README.md)**.

## Backend bez Dockera (szybsza pętla przy developmencie)

```bash
docker compose up -d db
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export JWT_SECRET=$(openssl rand -hex 32)
alembic upgrade head
uvicorn app.main:app --reload
```

Testy (potrzebują bazy `shoplist_test`, którą compose tworzy przy pierwszym starcie):

```bash
pytest -q
ruff check . && ruff format --check .
```

Zmiana modeli:

```bash
alembic revision --autogenerate -m "opis zmiany"   # przejrzyj wygenerowany plik!
alembic upgrade head
```

CI odpala `alembic check`, więc zmiana modelu bez migracji wywali pipeline.

## Web (`apps/web`)

React 19 + Vite, Storybook, testy w Jest. Logika (auth, listy, real-time,
optimistic update) siedzi w `@shoplist/core`. Web ma tylko ekrany i komponenty.

```bash
pnpm install
docker compose up -d            # backend + baza na localhost:8000
pnpm --filter @shoplist/web dev           # http://localhost:5173
pnpm --filter @shoplist/web storybook     # http://localhost:6006
```

Kontrole jak w CI:

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test
pnpm --filter @shoplist/web build && pnpm --filter @shoplist/web build-storybook
```

Struktura:

- `src/components`: komponenty prezentacyjne (tylko propsy) i ich `*.stories.tsx`
- `src/screens`: kontenery, które łączą hooki z core z widokami
- `src/lib`: router (History API), konfiguracja runtime, komunikaty błędów
- `test/`: Jest + Testing Library, w tym test integracyjny całej aplikacji
  z prawdziwym `ShoplistProvider` i atrapą fetch/WebSocketu

Trasy: `/` (moje listy), `/lists/:id`, `/join/:token` (link i kod QR z zaproszenia).

Adres API na produkcji podaje serwer przez `/config.js`, więc ten sam obraz
działa na każdym środowisku. Lokalnie: `VITE_API_URL`/`VITE_WS_URL` w `apps/web/.env`
albo domyślnie `localhost:8000`.

## Android (`apps/mobile`): start w tygodniu 3

**Cały monorepo ma React przypięty na `19.3.0`** (`pnpm.overrides` w `package.json`),
bo tyle wymaga Expo SDK 58. Dwie kopie Reacta kończą się błędem „Invalid hook call”
we wspólnych hookach. Projekt zakładaj na tym samym SDK:

```bash
pnpm create expo-app apps/mobile --template blank-typescript@sdk-58
cd apps/mobile && pnpm add @shoplist/core@workspace:* && npx expo install expo-secure-store expo-crypto
```

Nowsze SDK = nowa wersja Reacta, którą trzeba zmienić w `overrides` i w obu aplikacjach naraz.

Po każdej zmianie API (backend musi działać):

```bash
pnpm gen:api
```

### Konfiguracja `ShoplistProvider`

Web (`apps/web/src/main.tsx`):

```tsx
import { ShoplistProvider } from "@shoplist/core";

const config = {
  apiUrl: import.meta.env.VITE_API_URL,   // https://api.twojadomena.pl
  wsUrl: import.meta.env.VITE_WS_URL,     // wss://api.twojadomena.pl
  storage: window.localStorage,
  generateId: () => crypto.randomUUID(),  // działa tylko na HTTPS i localhost!
};

<ShoplistProvider config={config}><App /></ShoplistProvider>
```

Android (`apps/mobile`):

```tsx
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { ShoplistProvider, type KeyValueStorage } from "@shoplist/core";

const secureStorage: KeyValueStorage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};

const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL!,
  wsUrl: process.env.EXPO_PUBLIC_WS_URL!,
  storage: secureStorage,
  generateId: () => Crypto.randomUUID(),
};
```

Konfigurację twórz **raz**, poza komponentem (albo w `useMemo`). Nowy obiekt przy
każdym renderze odtwarza store listy i socket.

### Hooki

```tsx
const { status, user, loginAsGuest, logout } = useAuth();
// status: "loading" → "anonymous" | "authenticated"
// Ekrany wymagające logowania renderuj dopiero przy "authenticated".

const { lists, loading, refresh, createList } = useLists();
const { join, joining, error } = useJoinList();

const {
  list, status, connection, error,       // status: loading | ready | not_found | deleted | error
  addItem, toggleItem, updateItem, deleteItem,
  renameList, deleteList, clearError,
} = useList(listId);
```

Operacje są optymistyczne: UI zmienia się od razu, przy błędzie robi rollback
i ustawia `error`, który pokazujesz w toaście i czyścisz `clearError()`.
Operacje zwracają `Promise<boolean>` i nigdy nie rzucają.

Na emulatorze Androida backend z hosta jest pod `10.0.2.2:8000`, a na telefonie
w tej samej sieci pod IP komputera.
