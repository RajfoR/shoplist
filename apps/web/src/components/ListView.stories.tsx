import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ANIA, groceries, listDetail, ME } from "../fixtures";
import { ListView } from "./ListView";

const meta = {
  title: "Ekrany/Lista",
  component: ListView,
  args: {
    list: listDetail(groceries()),
    currentUserId: ME.id,
    connection: "open",
    shareUrl: "https://shoplist.example.pl/join/k3J9xQ2mTq8wZ1aB",
    onAdd: fn(),
    onToggle: fn(),
    onUpdate: fn(),
    onDelete: fn(),
    onRename: fn(),
    onDeleteList: fn(),
    onDismissError: fn(),
  },
} satisfies Meta<typeof ListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NaZywo: Story = { name: "Na żywo" };
export const PustaLista: Story = { name: "Pusta lista", args: { list: listDetail([]) } };
export const WszystkoKupione: Story = {
  name: "Wszystko kupione",
  args: { list: listDetail(groceries().map((i) => ({ ...i, checked: true }))) },
};
export const PonowneLaczenie: Story = { name: "Ponowne łączenie", args: { connection: "connecting" } };

/** Błąd operacji: core zrobił rollback, toast mówi, co się stało. */
export const BladZRollbackiem: Story = {
  name: "Błąd z rollbackiem",
  args: { error: "Brak połączenia z serwerem. Zmiana została cofnięta." },
};

/** Członek, który nie jest właścicielem, nie widzi „Usuń listę”. */
export const JakoGosc: Story = { name: "Jako gość (nie właściciel)", args: { currentUserId: ANIA.id } };

export const Zaproszenie: Story = { name: "Zaproszenie z kodem QR", args: { initialShareOpen: true } };
