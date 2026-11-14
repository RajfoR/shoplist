import { extractShareToken } from "../src/shareToken";

describe("extractShareToken", () => {
  test.each([
    ["pełny link z produkcji", "https://shoplist.pl/join/k3J9xQ2mTq8wZ1aB", "k3J9xQ2mTq8wZ1aB"],
    ["link lokalny z myślnikiem w tokenie", "http://localhost:5173/join/1065IPIO4L9Q8oM-QGFkkA", "1065IPIO4L9Q8oM-QGFkkA"],
    ["sam token ze spacjami wokół", "  k3J9xQ2mTq8wZ1aB  ", "k3J9xQ2mTq8wZ1aB"],
    ["link z parametrami po tokenie", "https://shoplist.pl/join/k3J9xQ2mTq8wZ1aB?utm=slajd#x", "k3J9xQ2mTq8wZ1aB"],
  ])("rozpoznaje: %s", (_opis, input, expected) => {
    expect(extractShareToken(input)).toBe(expected);
  });

  test.each([
    ["obcy link bez /join/", "https://example.com/promocja"],
    ["za krótki tekst", "abc"],
    ["niedozwolone znaki", "https://shoplist.pl/join/a%20b%20cdefgh"],
    ["uszkodzone kodowanie %", "https://evil.pl/join/%ZZ"],
    ["pusty napis", ""],
  ])("odrzuca: %s", (_opis, input) => {
    expect(extractShareToken(input)).toBeNull();
  });
});