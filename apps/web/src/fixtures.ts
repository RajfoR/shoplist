// Dane przykładowe dla Storybooka i testów. Kształt 1:1 z API (typy z OpenAPI).
import type { Item, ListDetail, ShoppingList, User } from "@shoplist/api-client";

export const ME: User = { id: "u-rafal", display_name: "Rafał", is_guest: true };
export const ANIA: User = { id: "u-ania", display_name: "Ania", is_guest: true };
export const KUBA: User = { id: "u-kuba", display_name: "Kuba Nowak", is_guest: true };

let seq = 0;
export function item(name: string, overrides: Partial<Item> = {}): Item {
  seq += 1;
  return {
    id: `i-${seq}`,
    list_id: "l-1",
    name,
    quantity: null,
    checked: false,
    version: 1,
    created_by: ME.id,
    created_at: "2026-11-14T09:00:00Z",
    updated_at: "2026-11-14T09:00:00Z",
    ...overrides,
  };
}

export function listDetail(items: Item[], overrides: Partial<ListDetail> = {}): ListDetail {
  return {
    id: "l-1",
    name: "Biedronka w sobotę",
    owner_id: ME.id,
    created_at: "2026-11-14T08:00:00Z",
    updated_at: "2026-11-14T09:00:00Z",
    share_token: "k3J9xQ2mTq8wZ1aB",
    members: [ME, ANIA, KUBA],
    items,
    ...overrides,
  };
}

export const groceries = (): Item[] => [
  item("Mleko", { quantity: "2 l" }),
  item("Chleb żytni"),
  item("Pomidory", { quantity: "1 kg", created_by: ANIA.id }),
  item("Masło", { checked: true, version: 2 }),
  item("Jajka", { quantity: "10 szt.", checked: true, version: 3, created_by: KUBA.id }),
];

export const NOW = new Date("2026-11-14T12:00:00Z");

export const myLists: ShoppingList[] = [
  { id: "l-1", name: "Biedronka w sobotę", owner_id: ME.id, created_at: "2026-11-14T08:00:00Z", updated_at: "2026-11-14T11:52:00Z" },
  { id: "l-2", name: "Impreza u Kuby", owner_id: KUBA.id, created_at: "2026-11-10T08:00:00Z", updated_at: "2026-11-13T19:00:00Z" },
  { id: "l-3", name: "Chemia do mieszkania", owner_id: ME.id, created_at: "2026-11-01T08:00:00Z", updated_at: "2026-11-09T10:00:00Z" },
];
