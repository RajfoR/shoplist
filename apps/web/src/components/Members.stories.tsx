import type { Meta, StoryObj } from "@storybook/react-vite";

import { ANIA, KUBA, ME } from "../fixtures";
import { Members } from "./Members";

const meta = {
  title: "Lista/Members",
  component: Members,
  args: { currentUserId: ME.id },
  decorators: [
    (Story) => (
      <div className="page">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Members>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TylkoJa: Story = { name: "Tylko ja", args: { members: [ME] } };
export const TrzyOsoby: Story = { name: "Trzy osoby", args: { members: [ME, ANIA, KUBA] } };

/** Demo na zajęciach: cała grupa na jednej liście. */
export const CalaGrupa: Story = {
  name: "Cała grupa",
  args: {
    members: [ME, ANIA, KUBA, ...Array.from({ length: 22 }, (_, i) => ({ id: `u-${i}`, display_name: `Student ${i + 1}`, is_guest: true }))],
  },
};
