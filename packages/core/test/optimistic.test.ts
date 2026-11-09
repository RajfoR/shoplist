import {
  optimisticCreate,
  optimisticDelete,
  optimisticUpdate,
  rollbackCreate,
  rollbackDelete,
  rollbackUpdate,
  withServerItem,
} from "../src/optimistic";
import { item, listDetail } from "./fixtures";

describe("optimistic", () => {
  test("zmiana optymistyczna nie podbija wersji, więc serwer ją nadpisze", () => {
    const list = listDetail([item("a", { version: 3 })]);
    const optimistic = optimisticUpdate(list, "a", { checked: true });
    expect(optimistic.items[0]).toMatchObject({ checked: true, version: 3 });

    const fromServer = withServerItem(optimistic, item("a", { version: 4, checked: false }));
    expect(fromServer.items[0]).toMatchObject({ checked: false, version: 4 });
  });

  test("quantity: null czyści, pominięte pole zostaje", () => {
    const list = listDetail([item("a", { quantity: "2 l", name: "Mleko" })]);
    expect(optimisticUpdate(list, "a", { quantity: null }).items[0]!.quantity).toBeNull();
    expect(optimisticUpdate(list, "a", { checked: true }).items[0]).toMatchObject({
      quantity: "2 l",
      name: "Mleko",
    });
  });

  test("rollbackUpdate nie nadpisuje nowszej wersji z serwera", () => {
    const previous = item("a", { version: 2, name: "stare" });
    const newer = listDetail([item("a", { version: 3, name: "od kogoś innego" })]);
    expect(rollbackUpdate(newer, previous)).toBe(newer);

    const same = optimisticUpdate(listDetail([previous]), "a", { name: "moje" });
    expect(rollbackUpdate(same, previous).items[0]!.name).toBe("stare");
  });

  test("rollbackCreate usuwa tylko niepotwierdzony produkt", () => {
    const pending = optimisticCreate(listDetail(), item("a", { version: 0 }));
    expect(rollbackCreate(pending, "a").items).toEqual([]);

    const confirmed = listDetail([item("a", { version: 1 })]);
    expect(rollbackCreate(confirmed, "a")).toBe(confirmed);
  });

  test("rollbackDelete wstawia produkt z powrotem na właściwe miejsce", () => {
    const a = item("a", { created_at: "2026-11-08T10:00:00Z" });
    const b = item("b", { created_at: "2026-11-08T10:01:00Z" });
    const c = item("c", { created_at: "2026-11-08T10:02:00Z" });
    const afterDelete = optimisticDelete(listDetail([a, b, c]), "b");
    expect(rollbackDelete(afterDelete, b).items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  test("brak zmian zwraca ten sam obiekt (mniej re-renderów)", () => {
    const list = listDetail([item("a")]);
    expect(optimisticUpdate(list, "nie-ma", { checked: true })).toBe(list);
    expect(optimisticDelete(list, "nie-ma")).toBe(list);
    expect(optimisticCreate(list, item("a"))).toBe(list);
  });
});
