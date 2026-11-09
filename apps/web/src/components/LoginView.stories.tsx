import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { LoginView } from "./LoginView";

const meta = {
  title: "Ekrany/Logowanie",
  component: LoginView,
  args: { onSubmit: fn() },
} satisfies Meta<typeof LoginView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wejscie: Story = { name: "Wejście" };
export const ZLinkuZaproszenia: Story = { name: "Z linku zaproszenia", args: { joining: true } };
export const BrakPolaczenia: Story = { name: "Brak połączenia", args: { error: "Brak połączenia z serwerem." } };
