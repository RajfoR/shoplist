// Kolor osoby liczony z jej id: stały między sesjami i urządzeniami.
const PALETTE = ["#2f7fc1", "#2e8b57", "#b4559e", "#c27a12", "#6a5acd", "#0f8f8a", "#c2410c"];

export function personColor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // „Kuba Nowak” → KN, „Rafał” → R
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : (parts[0]?.[0] ?? "?");
  return letters.toUpperCase();
}
