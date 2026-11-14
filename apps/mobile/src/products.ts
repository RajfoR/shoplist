// Wyszukiwanie produktu po kodzie kreskowym w Open Food Facts:
// otwartej, darmowej bazie produktów spożywczych (bez klucza API).

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
// OFF prosi, żeby każda aplikacja przedstawiała się własnym User-Agentem.
const USER_AGENT = "Shoplist/1.0 (projekt studencki)";
const TIMEOUT_MS = 6000;

export interface ScannedProduct {
  barcode: string;
  name: string;
  quantity: string | null;
}

export type LookupResult =
  | { status: "found"; product: ScannedProduct }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Czy to poprawny kod EAN-8, EAN-13 lub UPC-A (12 cyfr)?
 * Sprawdzamy cyfrę kontrolną, żeby odrzucić błędne odczyty aparatu,
 * zanim w ogóle zapytamy serwer.
 */
export function isValidBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  // Od prawej strony (bez cyfry kontrolnej) wagi na zmianę 3 i 1.
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

interface OffProduct {
  product_name?: string;
  product_name_pl?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
}

/** Odpowiedź Open Food Facts → nazwa i ilość do naszej listy (albo null). */
export function parseOffProduct(barcode: string, json: unknown): ScannedProduct | null {
  if (!json || typeof json !== "object") return null;
  const { status, product } = json as { status?: number; product?: OffProduct };
  if (status !== 1 || !product) return null;

  const baseName = (product.product_name_pl || product.product_name || product.generic_name || "").trim();
  if (!baseName) return null;

  // "Łaciate, Mlekpol" → "Łaciate". Dopisujemy markę, jeśli nie ma jej już w nazwie.
  const brand = product.brands?.split(",")[0]?.trim() ?? "";
  const withBrand =
    brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${baseName} ${brand}` : baseName;

  const quantity = product.quantity?.trim() || null;
  return {
    barcode,
    name: withBrand.slice(0, 120), // limity długości jak w backendzie
    quantity: quantity ? quantity.slice(0, 40) : null,
  };
}

/** Pyta Open Food Facts o produkt. Nigdy nie rzuca: błąd wraca jako wynik. */
export async function lookupProduct(barcode: string, fetchImpl: typeof fetch = fetch): Promise<LookupResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${OFF_URL}/${encodeURIComponent(barcode)}?fields=product_name,product_name_pl,generic_name,brands,quantity`;
    const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (res.status === 404) return { status: "not_found" };
    if (res.status === 429 || res.status === 503) {
      return { status: "error", message: "Baza produktów jest chwilowo przeciążona. Spróbuj za minutę." };
    }
    if (!res.ok) return { status: "error", message: "Baza produktów nie odpowiada. Spróbuj ponownie." };
    const product = parseOffProduct(barcode, await res.json());
    return product ? { status: "found", product } : { status: "not_found" };
  } catch {
    return { status: "error", message: "Brak połączenia z bazą produktów. Sprawdź internet." };
  } finally {
    clearTimeout(timer);
  }
}