import type { ShoppingList } from "@shoplist/api-client";
import { useState, type FormEvent } from "react";

import { Link, paths } from "../lib/router";

export interface ListsViewProps {
  userName: string;
  lists: ShoppingList[];
  loading: boolean;
  error?: string | null;
  creating?: boolean;
  onCreate: (name: string) => void;
  onLogout: () => void;
  onRetry?: () => void;
  /** Do testów i Storybooka: stała „teraz”. */
  now?: Date;
}

const rtf = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });

export function relativeTime(iso: string, now: Date): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "przed chwilą";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function ListsView(props: ListsViewProps) {
  const { userName, lists, loading, error, creating, onCreate, onLogout, onRetry, now = new Date() } = props;
  const [name, setName] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
  };

  return (
    <main className="page">
      <header className="topbar">
        <span className="topbar__who">Cześć, {userName}</span>
        <button type="button" className="text-button" onClick={onLogout}>
          Wyloguj
        </button>
      </header>

      <h1 className="page__title">Twoje listy</h1>

      <form className="new-list" onSubmit={submit}>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nowa lista, np. Biedronka"
          aria-label="Nazwa nowej listy"
          maxLength={80}
        />
        <button type="submit" className="button" disabled={creating || !name.trim()}>
          Utwórz
        </button>
      </form>

      {error ? (
        <div className="notice" role="alert">
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="button button--secondary" onClick={onRetry}>
              Spróbuj ponownie
            </button>
          )}
        </div>
      ) : loading && lists.length === 0 ? (
        <p className="muted" aria-busy="true">
          Wczytuję listy…
        </p>
      ) : lists.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Nie masz jeszcze żadnej listy.</p>
          <p className="muted">
            Utwórz pierwszą powyżej albo otwórz link czy kod QR, który dostałeś od znajomego.
          </p>
        </div>
      ) : (
        <ul className="lists">
          {lists.map((list) => (
            <li key={list.id}>
              <Link className="lists__row" to={paths.list(list.id)}>
                <span className="lists__name">{list.name}</span>
                <span className="lists__meta">zmieniona {relativeTime(list.updated_at, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
