// Token zaproszenia: litery, cyfry, "-" i "_" (format secrets.token_urlsafe z backendu).
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Wyciąga token zaproszenia z tego, co zeskanował aparat albo wkleił użytkownik.
 * Przyjmuje pełny link (https://…/join/<token>) albo sam token.
 * Zwraca null, gdy to nie jest zaproszenie do Shoplist.
 *
 * Celowo nie otwieramy zeskanowanego adresu: bierzemy z niego tylko token,
 * więc obcy kod QR nie przeniesie użytkownika na dowolną stronę.
 */
export function extractShareToken(input: string): string | null {
  const text = input.trim();
  const fromLink = /\/join\/([^/?#\s]+)/.exec(text);
  let candidate = fromLink ? fromLink[1]! : text;
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null; // uszkodzone kodowanie %xx
  }
  return TOKEN.test(candidate) ? candidate : null;
}