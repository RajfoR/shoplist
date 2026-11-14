import { isValidBarcode, lookupProduct, parseOffProduct } from "../src/products";

describe("isValidBarcode", () => {
  test.each([
    ["EAN-13", "5901234123457"],
    ["EAN-13", "4006381333931"],
    ["EAN-8", "96385074"],
    ["UPC-A", "036000291452"],
  ])("przyjmuje poprawny %s: %s", (_typ, code) => {
    expect(isValidBarcode(code)).toBe(true);
  });

  test.each([
    ["zła cyfra kontrolna", "5901234123458"],
    ["za krótki", "1234567"],
    ["litery", "59012341234AB"],
    ["kod QR z linkiem", "https://shoplist.pl/join/abc"],
  ])("odrzuca: %s", (_opis, code) => {
    expect(isValidBarcode(code)).toBe(false);
  });
});

describe("parseOffProduct", () => {
  test("bierze polską nazwę, dopisuje markę i ilość", () => {
    const json = {
      status: 1,
      product: { product_name: "UHT Milk", product_name_pl: "Mleko UHT 3,2%", brands: "Łaciate, Mlekpol", quantity: "1 l" },
    };
    expect(parseOffProduct("5900820000202", json)).toEqual({
      barcode: "5900820000202",
      name: "Mleko UHT 3,2% Łaciate",
      quantity: "1 l",
    });
  });

  test("nie dubluje marki, która jest już w nazwie", () => {
    const json = { status: 1, product: { product_name: "Nutella krem", brands: "Nutella" } };
    expect(parseOffProduct("1", json)?.name).toBe("Nutella krem");
  });

  test("brak produktu albo pustej nazwy daje null", () => {
    expect(parseOffProduct("1", { status: 0 })).toBeNull();
    expect(parseOffProduct("1", { status: 1, product: { product_name: "  " } })).toBeNull();
    expect(parseOffProduct("1", "nie json")).toBeNull();
  });

  test("przycina nazwę do limitu backendu (120 znaków)", () => {
    const json = { status: 1, product: { product_name: "x".repeat(300) } };
    expect(parseOffProduct("1", json)?.name).toHaveLength(120);
  });
});

describe("lookupProduct", () => {
  const response = (status: number, body: unknown = {}) =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;

  test("znaleziony produkt; zapytanie z własnym User-Agentem", async () => {
    const fetchMock = jest.fn(async () =>
      response(200, { status: 1, product: { product_name: "Masło", quantity: "200 g" } }),
    );
    const result = await lookupProduct("5901234123457", fetchMock as unknown as typeof fetch);

    expect(result).toEqual({
      status: "found",
      product: { barcode: "5901234123457", name: "Masło", quantity: "200 g" },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/v2/product/5901234123457");
    expect(init.headers).toEqual({ "User-Agent": expect.stringContaining("Shoplist") });
  });

  test("404 z bazy to brak produktu, a nie błąd", async () => {
    const result = await lookupProduct("1", (async () => response(404)) as unknown as typeof fetch);
    expect(result).toEqual({ status: "not_found" });
  });

  test("przeciążenie bazy (503) daje czytelny komunikat", async () => {
    const result = await lookupProduct("1", (async () => response(503)) as unknown as typeof fetch);
    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("przeciążona") });
  });

  test("brak sieci nie rzuca wyjątku", async () => {
    const offline = (async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    await expect(lookupProduct("1", offline)).resolves.toMatchObject({ status: "error" });
  });
});