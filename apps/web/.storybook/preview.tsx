import "@fontsource-variable/bricolage-grotesque";
import "../src/styles.css";

import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    controls: { expanded: true },
  },
  tags: ["autodocs"],
};

export default preview;
