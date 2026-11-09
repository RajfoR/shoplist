// Czysta funkcja: stan listy + event → nowy stan. Wspólna dla weba i mobile'a,
// łatwa do przetestowania w Jest bez żadnego UI.
import type { ListEvent } from "./events";
import type { Item, ListDetail } from "./types";

export function upsertItem(items: Item[], incoming: Item): Item[] {
  const idx = items.findIndex((i) => i.id === incoming.id);
  if (idx === -1) return [...items, incoming];
  const current = items[idx]!;
  // Reguła wersji z kontraktu: starsze lub równe = już to mamy (np. własne echo).
  if (incoming.version <= current.version) return items;
  const next = items.slice();
  next[idx] = incoming;
  return next;
}

/** Zwraca `null`, gdy lista została usunięta: UI powinien wtedy wyjść z ekranu. */
export function applyEvent(state: ListDetail, event: ListEvent): ListDetail | null {
  if (event.list_id !== state.id) return state;
  switch (event.type) {
    case "item.created":
    case "item.updated":
      return { ...state, items: upsertItem(state.items, event.data) };
    case "item.deleted":
      return { ...state, items: state.items.filter((i) => i.id !== event.data.id) };
    case "list.updated":
      return { ...state, ...event.data };
    case "list.deleted":
      return null;
    case "member.joined":
      if (state.members.some((m) => m.id === event.data.id)) return state;
      return { ...state, members: [...state.members, event.data] };
    default:
      return state; // nieznane eventy ignorujemy (kontrakt, pkt "Eventy")
  }
}
