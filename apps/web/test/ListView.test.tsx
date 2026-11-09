import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListView, type ListViewProps } from "../src/components/ListView";
import { ANIA, groceries, listDetail, ME } from "../src/fixtures";

function setup(overrides: Partial<ListViewProps> = {}) {
  const props: ListViewProps = {
    list: listDetail(groceries()),
    currentUserId: ME.id,
    connection: "open",
    shareUrl: "https://example.pl/join/tok",
    onAdd: jest.fn(),
    onToggle: jest.fn(),
    onUpdate: jest.fn(),
    onDelete: jest.fn(),
    onRename: jest.fn(),
    onDeleteList: jest.fn(),
    onDismissError: jest.fn(),
    ...overrides,
  };
  render(<ListView {...props} />);
  return { props, user: userEvent.setup() };
}

test("kupione produkty są w osobnej sekcji pod listą do kupienia", () => {
  setup();
  const [toBuy, inCart] = screen.getAllByRole("list");
  expect(within(toBuy!).getAllByRole("checkbox")).toHaveLength(3);
  expect(within(inCart!).getAllByRole("checkbox")).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "W koszyku: 2" })).toBeTruthy();
});

test("właściciel może usunąć listę po potwierdzeniu", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  const { props, user } = setup();
  await user.click(screen.getByRole("button", { name: "Usuń listę" }));
  expect(confirm).toHaveBeenCalled();
  expect(props.onDeleteList).toHaveBeenCalled();
});

test("członek, który nie jest właścicielem, nie widzi przycisku usuwania", () => {
  setup({ currentUserId: ANIA.id });
  expect(screen.queryByRole("button", { name: "Usuń listę" })).toBeNull();
});

test("zmiana nazwy listy po kliknięciu w tytuł", async () => {
  const { props, user } = setup();
  await user.click(screen.getByRole("button", { name: /Zmień nazwę listy/ }));
  const input = screen.getByRole("textbox", { name: "Nazwa listy" });
  await user.clear(input);
  await user.type(input, "Lidl{Enter}");
  expect(props.onRename).toHaveBeenCalledWith("Lidl");
});

test("toast z błędem da się zamknąć", async () => {
  const { props, user } = setup({ error: "Brak połączenia z serwerem. Zmiana została cofnięta." });
  expect(screen.getByRole("alert").textContent).toContain("Zmiana została cofnięta");
  await user.click(screen.getByRole("button", { name: "OK" }));
  expect(props.onDismissError).toHaveBeenCalled();
});

test("arkusz zaproszenia pokazuje link i kod QR", async () => {
  const { user } = setup();
  await user.click(screen.getByRole("button", { name: "Zaproś" }));
  const dialog = screen.getByRole("dialog", { name: "Zaproś do listy" });
  expect(within(dialog).getByRole("textbox", { name: "Link do listy" })).toHaveProperty(
    "value",
    "https://example.pl/join/tok",
  );
  expect(await within(dialog).findByRole("img", { name: /Kod QR/ })).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
});
