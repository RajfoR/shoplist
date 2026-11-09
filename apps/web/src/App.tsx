import { useAuth } from "@shoplist/core";

import { useRoute } from "./lib/router";
import { JoinScreen } from "./screens/JoinScreen";
import { ListScreen, StatusPage } from "./screens/ListScreen";
import { ListsScreen } from "./screens/ListsScreen";
import { LoginScreen } from "./screens/LoginScreen";

export function App() {
  const { status } = useAuth();
  const route = useRoute();

  // Sesja z localStorage odtwarza się asynchronicznie. Ekrany z hookami
  // wymagającymi logowania renderujemy dopiero przy "authenticated".
  if (status === "loading") return null;
  if (status === "anonymous") return <LoginScreen joining={route.name === "join"} />;

  switch (route.name) {
    case "lists":
      return <ListsScreen />;
    case "list":
      return <ListScreen key={route.id} listId={route.id} />;
    case "join":
      return <JoinScreen token={route.token} />;
    case "notFound":
      return <StatusPage title="Nie ma takiej strony" />;
  }
}
