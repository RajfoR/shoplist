import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AddItemForm } from "../src/components/AddItemForm";

test("dodaje przycięte wartości, czyści pola i zostawia fokus w nazwie", async () => {
  const onAdd = jest.fn();
  const user = userEvent.setup();
  render(<AddItemForm onAdd={onAdd} />);

  const name = screen.getByRole("textbox", { name: "Co kupić?" });
  await user.type(name, "  Jabłka ");
  await user.type(screen.getByRole("textbox", { name: "Ilość" }), " 2 kg ");
  await user.keyboard("{Enter}");

  expect(onAdd).toHaveBeenCalledWith("Jabłka", "2 kg");
  expect(name).toHaveProperty("value", "");
  expect(document.activeElement).toBe(name);
});

test("pusta ilość to null, pusta nazwa nic nie wysyła", async () => {
  const onAdd = jest.fn();
  const user = userEvent.setup();
  render(<AddItemForm onAdd={onAdd} />);

  await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "   {Enter}");
  expect(onAdd).not.toHaveBeenCalled();

  await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "Ser{Enter}");
  expect(onAdd).toHaveBeenCalledWith("Ser", null);
});
