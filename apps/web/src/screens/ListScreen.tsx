import { useAuth, useList } from "@shoplist/core";
import { useEffect } from "react";

import { ListView } from "../components/ListView";
import { describeError } from "../lib/errors";
import { Link, paths } from "../lib/router";

const TOAST_MS = 5000;

export function ListScreen({ listId }: { listId: string }) {
  const { user } = useAuth();
  const list = useList(listId);
  const { error, clearError } = list;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, TOAST_MS);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  useEffect(() => {
    if (list.list) document.title = `${list.list.name} · Shoplist`;
    return () => {
      document.title = "Shoplist";
    };
  }, [list.list]);

  if (list.status === "loading" || (list.status === "error" && !list.list)) {
    return (
      <StatusPage
        title={list.status === "loading" ? "Wczytuję listę…" : "Nie udało się wczytać listy"}
        body={list.status === "error" ? "Sprawdź połączenie. Spróbuję ponownie, gdy wróci." : undefined}
        action={list.status === "error" ? { label: "Spróbuj teraz", onClick: () => void list.resync() } : undefined}
      />
    );
  }
  if (list.status === "not_found") {
    return (
      <StatusPage
        title="Nie masz dostępu do tej listy"
        body="Lista nie istnieje albo nie jesteś jej członkiem. Poproś właściciela o link lub kod QR."
      />
    );
  }
  if (list.status === "deleted" || !list.list || !user) {
    return <StatusPage title="Ta lista została usunięta" body="Właściciel usunął ją dla wszystkich." />;
  }

  const shareUrl = `${window.location.origin}${paths.join(list.list.share_token)}`;

  return (
    <ListView
      list={list.list}
      currentUserId={user.id}
      connection={list.connection}
      shareUrl={shareUrl}
      error={error ? describeError(error) : null}
      onDismissError={clearError}
      onAdd={(name, quantity) => void list.addItem(name, quantity)}
      onToggle={(id) => void list.toggleItem(id)}
      onUpdate={(id, patch) => void list.updateItem(id, patch)}
      onDelete={(id) => void list.deleteItem(id)}
      onRename={(name) => void list.renameList(name)}
      onDeleteList={() => void list.deleteList()}
    />
  );
}

interface StatusPageProps {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

export function StatusPage({ title, body, action }: StatusPageProps) {
  return (
    <main className="page page--status">
      <h1 className="page__title">{title}</h1>
      {body && <p className="muted">{body}</p>}
      <div className="status-actions">
        {action && (
          <button type="button" className="button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
        <Link className="button button--secondary" to={paths.lists()}>
          Wróć do list
        </Link>
      </div>
    </main>
  );
}
