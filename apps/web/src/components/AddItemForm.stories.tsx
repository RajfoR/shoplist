import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { AddItemForm } from "./AddItemForm";

const meta = {
  title: "Lista/AddItemForm",
  component: AddItemForm,
  args: { onAdd: fn() },
  decorators: [
    (Story) => (
      <div className="page">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddItemForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Domyslny: Story = { name: "Domyślny" };
export const Zablokowany: Story = { name: "Zablokowany", args: { disabled: true } };
