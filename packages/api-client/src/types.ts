// Aliasy na typy wygenerowane z OpenAPI (`pnpm gen:api`). Nie edytuj schema.d.ts ręcznie.
import type { components } from "./schema";

type S = components["schemas"];
export type User = S["UserOut"];
export type Item = S["ItemOut"];
export type ShoppingList = S["ListOut"];
export type ListDetail = S["ListDetail"];
export type TokenOut = S["TokenOut"];
export type ItemCreate = S["ItemCreate"];
export type ItemUpdate = S["ItemUpdate"];
