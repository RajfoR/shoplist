import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ShareSheet } from "./ShareSheet";

const meta = {
  title: "Lista/ShareSheet",
  component: ShareSheet,
  args: {
    listName: "Biedronka w sobotę",
    url: "https://shoplist.example.pl/join/k3J9xQ2mTq8wZ1aB",
    onClose: fn(),
  },
} satisfies Meta<typeof ShareSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Kod QR jest prawdziwy: zeskanuj go telefonem z ekranu. */
export const KodQR: Story = { name: "Kod QR" };
