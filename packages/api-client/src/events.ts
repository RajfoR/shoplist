// Eventy WebSocket — muszą odpowiadać docs/CONTRACT.md.
import type { Item, ShoppingList, User } from "./types";

interface Envelope<T extends string, D> {
  type: T;
  list_id: string;
  actor_id: string;
  ts: string;
  data: D;
}

export type ListEvent =
  | Envelope<"item.created", Item>
  | Envelope<"item.updated", Item>
  | Envelope<"item.deleted", { id: string }>
  | Envelope<"list.updated", ShoppingList>
  | Envelope<"list.deleted", { id: string }>
  | Envelope<"member.joined", User>;

export type ServerMessage =
  | { type: "ready"; list_id: string; user_id: string }
  | { type: "pong" }
  | ListEvent;

export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_NOT_FOUND = 4404;
