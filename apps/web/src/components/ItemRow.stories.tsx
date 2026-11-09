import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { item } from "../fixtures";
import { ItemRow, type ItemRowProps } from "./ItemRow";

const meta = {
  title: "Lista/ItemRow",
  component: ItemRow,
  args: { onToggle: fn(), onUpdate: fn(), onDelete: fn() },
  decorators: [
    (Story) => (
      <div className="page">
        <section className="sheet">
          <ul className="items">
            <Story />
          </ul>
        </section>
      </div>
    ),
  ],
} satisfies Meta<typeof ItemRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DoKupienia: Story = { name: "Do kupienia", args: { item: item("Mleko", { quantity: "2 l" }) } };

export const BezIlosci: Story = { name: "Bez ilości", args: { item: item("Chleb żytni") } };

export const Kupione: Story = { name: "Kupione", args: { item: item("Masło", { checked: true }) } };

export const DlugaNazwa: Story = {
  name: "Długa nazwa",
  args: { item: item("Pomidory malinowe z targu, najlepiej od tego pana przy wejściu", { quantity: "1,5 kg" }) },
};

/** Kliknij wiersz: skreślenie flamastrem rośnie od lewej. */
export const Interaktywny: Story = {
  name: "Interaktywny",
  args: { item: item("Kawa ziarnista", { quantity: "1 kg" }) },
  render: (args) => <InteractiveRow {...args} />,
};

function InteractiveRow(props: ItemRowProps) {
  const [current, setCurrent] = useState(props.item);
  return (
    <ItemRow
      {...props}
      item={current}
      onToggle={(id) => {
        props.onToggle(id);
        setCurrent((i) => ({ ...i, checked: !i.checked }));
      }}
      onUpdate={(id, patch) => {
        props.onUpdate(id, patch);
        setCurrent((i) => ({
          ...i,
          name: patch.name ?? i.name,
          quantity: patch.quantity === undefined ? i.quantity : patch.quantity,
        }));
      }}
    />
  );
}
