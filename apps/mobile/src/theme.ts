import { useColorScheme } from "react-native";

// Te same wartości co w apps/web/src/styles.css (:root i tryb ciemny),
// żeby web i Android wyglądały spójnie.
const light = {
  bg: "#e9efec",
  paper: "#ffffff",
  grid: "#dbe5ef",
  ink: "#17231d",
  muted: "#5d6c65",
  line: "#ccd8d2",
  marker: "#e5402a",
  live: "#2e8b57",
  pending: "#b7791f",
  focus: "#2f6fc1",
};

const dark: typeof light = {
  bg: "#0f1513",
  paper: "#17201c",
  grid: "#22302a",
  ink: "#e4ece7",
  muted: "#93a39b",
  line: "#2b3832",
  marker: "#ff6b4f",
  live: "#4cc285",
  pending: "#e0a43a",
  focus: "#7fb2ff",
};

export type Colors = typeof light;

/** Paleta zgodna z trybem jasnym/ciemnym ustawionym w telefonie. */
export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}