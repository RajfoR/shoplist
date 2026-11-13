// Adres backendu wklejany przez Expo przy pakowaniu (zmienne EXPO_PUBLIC_*).
const raw = process.env.EXPO_PUBLIC_API_URL;

if (!raw) {
  throw new Error(
    "Brak EXPO_PUBLIC_API_URL. Skopiuj apps/mobile/.env.example do .env i uruchom `npx expo start -c`.",
  );
}

export const apiUrl = raw.replace(/\/+$/, "");

// WebSocket pod tym samym hostem: http → ws, https → wss.
export const wsUrl = apiUrl.replace(/^http/, "ws");
