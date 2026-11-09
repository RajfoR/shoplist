import type { Meta, StoryObj } from "@storybook/react-vite";

import { ConnectionBadge } from "./ConnectionBadge";

const meta = {
  title: "Lista/ConnectionBadge",
  component: ConnectionBadge,
  decorators: [
    (Story) => (
      <div className="page">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectionBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NaZywo: Story = { name: "Na żywo", args: { status: "open" } };
export const Laczenie: Story = { name: "Łączenie", args: { status: "connecting" } };
export const Rozlaczono: Story = { name: "Rozłączono", args: { status: "closed" } };
