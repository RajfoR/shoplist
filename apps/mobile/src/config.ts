// Adresy wklejane przez Expo przy pakowaniu (zmienne EXPO_PUBLIC_*).
// Uwaga: Expo podmienia tylko zapis wprost `process.env.EXPO_PUBLIC_…`,
// dlatego nie czytamy ich w pętli ani przez zmienną z nazwą.
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
const rawWebUrl = process.env.EXPO_PUBLIC_WEB_URL;

if (!rawApiUrl || !rawWebUrl) {
  throw new Error(
    "Brak EXPO_PUBLIC_API_URL lub EXPO_PUBLIC_WEB_URL. Uzupełnij apps/mobile/.env (wzór w .env.example) i uruchom `npx expo start -c`.",
  );
}

export const apiUrl = rawApiUrl.replace(/\/+$/, "");

// WebSocket pod tym samym hostem: http → ws, https → wss.
export const wsUrl = apiUrl.replace(/^http/, "ws");

// Adres aplikacji webowej: z niego budujemy linki zaproszeń.
export const webUrl = rawWebUrl.replace(/\/+$/, "");

/** Link zaproszenia: ten sam format co na webie (trasa /join/:token). */
export function joinUrl(shareToken: string): string {
  return `${webUrl}/join/${encodeURIComponent(shareToken)}`;
}