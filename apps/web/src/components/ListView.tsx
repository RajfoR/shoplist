import type { ItemUpdate, ListDetail } from "@shoplist/api-client";
import type { ConnectionStatus } from "@shoplist/core";
import { useState, type FormEvent } from "react";

import { Link, paths } from "../lib/router";
import { AddItemForm } from "./AddItemForm";
import { ConnectionBadge } from "./ConnectionBadge";
import { BackIcon, ShareIcon } from "./Icons";
import { ItemRow } from "./ItemRow";
import { Members } from "./Members";
import { ShareSheet } from "./ShareSheet";
import { Toast } from "./Toast";

export interface ListViewProps {
  list: ListDetail;
  currentUserId: string;
  connection: ConnectionStatus;
  shareUrl: string;
  error?: string | null;
  onDismissError?: () => void;
  onAdd: (name: string, quantity: string | null) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: ItemUpdate) => void;
  onDelete: (id: string) => void;
  onRename: (name: string) => void;
  onDeleteList: () => void;
  /** Storybook: od razu otwarty arkusz udostępniania. */
  initialShareOpen?: boolean;
}

export function ListView(props: ListViewProps) {
  const { list, currentUserId, connection, shareUrl, error, onDismissError } = props;
  const [shareOpen, setShareOpen] = useState(props.initialShareOpen ?? false);

  // Do kupienia na górze, w kolejności dodania. Kupione zjeżdżają niżej.
  const toBuy = list.items.filter((i) => !i.checked);
  const inCart = list.items.filter((i) => i.checked);
  const isOwner = list.owner_id === currentUserId;
  const rowProps = { onToggle: props.onToggle, onUpdate: props.onUpdate, onDelete: props.onDelete };

  return (
    <main className="page page--list">
      <header className="topbar">
        <Link className="back-link" to={paths.lists()}>
          <BackIcon />
          Twoje listy
        </Link>
        <button type="button" className="button button--secondary button--small" onClick={() => setShareOpen(true)}>
          <ShareIcon />
          Zaproś
        </button>
      </header>

      <ListTitle name={list.name} onRename={props.onRename} />

      <div className="list-meta">
        <ConnectionBadge status={connection} />
        <Members members={list.members} currentUserId={currentUserId} />
      </div>

      <section className="sheet" aria-label="Produkty">
        {list.items.length === 0 ? (
          <p className="sheet__empty">Lista jest pusta. Wpisz pierwszą rzecz w polu na dole ekranu.</p>
        ) : (
          <>
            {toBuy.length > 0 ? (
              <ul className="items">
                {toBuy.map((item) => (
                  <ItemRow key={item.id} item={item} {...rowProps} />
                ))}
              </ul>
            ) : (
              <p className="sheet__empty">Wszystko kupione.</p>
            )}
            {inCart.length > 0 && (
              <>
                <h2 className="sheet__section">W koszyku: {inCart.length}</h2>
                <ul className="items">
                  {inCart.map((item) => (
                    <ItemRow key={item.id} item={item} {...rowProps} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {isOwner && (
        <button
          type="button"
          className="text-button delete-list"
          onClick={() => {
            if (window.confirm(`Usunąć listę „${list.name}” u wszystkich osób?`)) props.onDeleteList();
          }}
        >
          Usuń listę
        </button>
      )}

      <div className="dock">
        {error && <Toast message={error} onDismiss={() => onDismissError?.()} />}
        <AddItemForm onAdd={props.onAdd} />
      </div>

      {shareOpen && <ShareSheet listName={list.name} url={shareUrl} onClose={() => setShareOpen(false)} />}
    </main>
  );
}

function ListTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!editing) {
    return (
      <h1 className="page__title">
        <button
          type="button"
          className="title-button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          aria-label={`Zmień nazwę listy: ${name}`}
        >
          {name}
        </button>
      </h1>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <form className="title-form" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
      <input
        className="field title-form__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={80}
        aria-label="Nazwa listy"
        autoFocus
      />
      <button type="submit" className="button button--small">
        Zapisz
      </button>
    </form>
  );
}
