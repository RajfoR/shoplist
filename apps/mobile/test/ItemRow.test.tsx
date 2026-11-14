import type { Item } from "@shoplist/api-client";
import { render, screen, userEvent } from "@testing-library/react-native";

import { ItemRow } from "../src/components/ItemRow";

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    list_id: "list-1",
    name: "Mleko",
    quantity: "2 l",
    checked: false,
    version: 1,
    created_by: "user-1",
    created_at: "2026-11-14T10:00:00Z",
    updated_at: "2026-11-14T10:00:00Z",
    ...overrides,
  };
}

async function setup(overrides: Partial<Item> = {}) {
  const handlers = { onToggle: jest.fn(), onUpdate: jest.fn(), onDelete: jest.fn() };
  const user = userEvent.setup();
  await render(<ItemRow item={item(overrides)} {...handlers} />);
  return { ...handlers, user };
}

test("pokazuje nazwę i ilość, a stan odhaczenia trafia do czytnika ekranu", async () => {
  await setup({ checked: true });
  const row = screen.getByRole("checkbox", { name: "Mleko, 2 l" });
  expect(row).toBeChecked();
});

test("dotknięcie wiersza odhacza produkt", async () => {
  const { onToggle, user } = await setup();
  await user.press(screen.getByRole("checkbox", { name: "Mleko, 2 l" }));
  expect(onToggle).toHaveBeenCalledWith("item-1");
});

test("przytrzymanie otwiera edycję, zapis wysyła tylko zmienione pole", async () => {
  const { onUpdate, user } = await setup();
  await user.longPress(screen.getByRole("checkbox", { name: "Mleko, 2 l" }));

  const qty = screen.getByLabelText("Ilość");
  await user.clear(qty);
  await user.type(qty, "3 l");
  await user.press(screen.getByRole("button", { name: "Zapisz" }));

  expect(onUpdate).toHaveBeenCalledWith("item-1", { quantity: "3 l" });
});

test("wyczyszczenie ilości wysyła quantity: null", async () => {
  const { onUpdate, user } = await setup();
  await user.longPress(screen.getByRole("checkbox", { name: "Mleko, 2 l" }));
  await user.clear(screen.getByLabelText("Ilość"));
  await user.press(screen.getByRole("button", { name: "Zapisz" }));
  expect(onUpdate).toHaveBeenCalledWith("item-1", { quantity: null });
});

test("zapis bez zmian nie wysyła żądania i zamyka edycję", async () => {
  const { onUpdate, user } = await setup();
  await user.longPress(screen.getByRole("checkbox", { name: "Mleko, 2 l" }));
  await user.press(screen.getByRole("button", { name: "Zapisz" }));
  expect(onUpdate).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox", { name: "Mleko, 2 l" })).toBeOnTheScreen();
});

test("Usuń w edytorze usuwa produkt", async () => {
  const { onDelete, user } = await setup();
  await user.longPress(screen.getByRole("checkbox", { name: "Mleko, 2 l" }));
  await user.press(screen.getByRole("button", { name: "Usuń" }));
  expect(onDelete).toHaveBeenCalledWith("item-1");
});