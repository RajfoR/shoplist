import { useAuth, useLists } from "@shoplist/core";
import { useState } from "react";

import { ListsView } from "../components/ListsView";
import { describeError } from "../lib/errors";
import { navigate, paths } from "../lib/router";

export function ListsScreen() {
  const { user, logout } = useAuth();
  const { lists, loading, error, refresh, createList } = useLists();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const create = async (name: string) => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createList(name);
      navigate(paths.list(created.id));
    } catch (err) {
      setCreateError(describeError(err as Error, { rolledBack: false }));
    } finally {
      setCreating(false);
    }
  };

  const shownError = createError ?? (error ? "Nie udało się wczytać list. Sprawdź połączenie." : null);

  return (
    <ListsView
      userName={user?.display_name ?? ""}
      lists={lists}
      loading={loading}
      error={shownError}
      creating={creating}
      onCreate={create}
      onLogout={() => void logout()}
      onRetry={() => {
        setCreateError(null);
        void refresh();
      }}
    />
  );
}
