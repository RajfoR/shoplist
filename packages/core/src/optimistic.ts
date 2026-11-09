// Czyste funkcje dla optimistic update i rollbacku. Bez Reacta, bez I/O.
//
// Zasada: zmiana optymistyczna NIE podbija `version`. Dzięki temu odpowiedź
// serwera albo event z WS (version + 1) zawsze ją nadpisze prawdą z serwera.
import { upsertItem, type Item, type ItemUpdate, type ListDetail } from "@shoplist/api-client";

/** Wersja produktu, którego serwer jeszcze nie potwierdził. */
export const UNCONFIRMED_VERSION = 0;

function byCreation(a: Item, b: Item): number {
  const diff = Date.parse(a.created_at) - Date.parse(b.created_at);
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export function withServerItem(list: ListDetail, item: Item): ListDetail {
  const items = upsertItem(list.items, item);
  return items === list.items ? list : { ...list, items };
}

export function optimisticCreate(list: ListDetail, item: Item): ListDetail {
  if (list.items.some((i) => i.id === item.id)) return list;
  return { ...list, items: [...list.items, item] };
}

export function optimisticUpdate(list: ListDetail, itemId: string, patch: ItemUpdate): ListDetail {
  let changed = false;
  const items = list.items.map((item) => {
    if (item.id !== itemId) return item;
    changed = true;
    return {
      ...item,
      ...(patch.name != null && { name: patch.name }),
      ...(patch.quantity !== undefined && { quantity: patch.quantity }),
      ...(patch.checked != null && { checked: patch.checked }),
    };
  });
  return changed ? { ...list, items } : list;
}

export function optimisticDelete(list: ListDetail, itemId: string): ListDetail {
  const items = list.items.filter((i) => i.id !== itemId);
  return items.length === list.items.length ? list : { ...list, items };
}

/** Usuwa produkt tylko, jeśli serwer go nie potwierdził (np. eventem z WS). */
export function rollbackCreate(list: ListDetail, itemId: string): ListDetail {
  const items = list.items.filter((i) => !(i.id === itemId && i.version === UNCONFIRMED_VERSION));
  return items.length === list.items.length ? list : { ...list, items };
}

/** Przywraca poprzedni stan, chyba że w międzyczasie przyszła nowsza wersja z serwera. */
export function rollbackUpdate(list: ListDetail, previous: Item): ListDetail {
  let changed = false;
  const items = list.items.map((item) => {
    if (item.id !== previous.id || item.version !== previous.version) return item;
    changed = true;
    return previous;
  });
  return changed ? { ...list, items } : list;
}

export function rollbackDelete(list: ListDetail, previous: Item): ListDetail {
  if (list.items.some((i) => i.id === previous.id)) return list;
  return { ...list, items: [...list.items, previous].sort(byCreation) };
}
