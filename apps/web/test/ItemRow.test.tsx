import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ItemRow } from "../src/components/ItemRow";
import { item } from "../src/fixtures";

function setup(overrides = {}) {
  const handlers = { onToggle: jest.fn(), onUpdate: jest.fn(), onDelete: jest.fn() };
  const it = item("Mleko", { quantity: "2 l", ...overrides });
  render(
    <ul>
      <ItemRow item={it} {...handlers} />
    </ul>,
  );
  return { it, ...handlers, user: userEvent.setup() };
}

test("klik w nazwę odhacza produkt (cały wiersz jest etykietą checkboxa)", async () => {
  const { it, onToggle, user } = setup();
  await user.click(screen.getByText("Mleko"));
  expect(onToggle).toHaveBeenCalledWith(it.id);
});

test("edycja wysyła tylko zmienione pola", async () => {
  const { it, onUpdate, user } = setup();
  await user.click(screen.getByRole("button", { name: "Edytuj: Mleko" }));
  const name = screen.getByRole("textbox", { name: "Nazwa" });
  await user.clear(name);
  await user.type(name, "Mleko owsiane");
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(onUpdate).toHaveBeenCalledWith(it.id, { name: "Mleko owsiane" });
});

test("wyczyszczenie ilości wysyła quantity: null", async () => {
  const { it, onUpdate, user } = setup();
  await user.click(screen.getByRole("button", { name: "Edytuj: Mleko" }));
  await user.clear(screen.getByRole("textbox", { name: "Ilość" }));
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(onUpdate).toHaveBeenCalledWith(it.id, { quantity: null });
});

test("zapis bez zmian nie wysyła żądania", async () => {
  const { onUpdate, user } = setup();
  await user.click(screen.getByRole("button", { name: "Edytuj: Mleko" }));
  await user.click(screen.getByRole("button", { name: "Zapisz" }));
  expect(onUpdate).not.toHaveBeenCalled();
});

test("Escape anuluje edycję, Usuń usuwa", async () => {
  const { it, onDelete, user } = setup();
  await user.click(screen.getByRole("button", { name: "Edytuj: Mleko" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox", { name: "Nazwa" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Edytuj: Mleko" }));
  await user.click(screen.getByRole("button", { name: "Usuń" }));
  expect(onDelete).toHaveBeenCalledWith(it.id);
});
