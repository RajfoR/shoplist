import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { myLists, NOW } from "../fixtures";
import { ListsView } from "./ListsView";

const meta = {
  title: "Ekrany/Moje listy",
  component: ListsView,
  args: {
    userName: "Rafał",
    lists: myLists,
    loading: false,
    now: NOW,
    onCreate: fn(),
    onLogout: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof ListsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KilkaList: Story = { name: "Kilka list" };
export const Pusto: Story = { name: "Pusto", args: { lists: [] } };
export const Wczytywanie: Story = { name: "Wczytywanie", args: { lists: [], loading: true } };
export const Blad: Story = { name: "Błąd", args: { lists: [], error: "Nie udało się wczytać list. Sprawdź połączenie." } };
