import type { Item, ItemUpdate } from "@shoplist/api-client";
import { useId, useState, type FormEvent } from "react";

import { PencilIcon } from "./Icons";

export interface ItemRowProps {
  item: Item;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: ItemUpdate) => void;
  onDelete: (id: string) => void;
}

export function ItemRow({ item, onToggle, onUpdate, onDelete }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const checkboxId = useId();

  if (editing) {
    return (
      <li className="item item--editing">
        <ItemEditor
          item={item}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            setEditing(false);
            if (Object.keys(patch).length > 0) onUpdate(item.id, patch);
          }}
          onDelete={() => onDelete(item.id)}
        />
      </li>
    );
  }

  return (
    <li className="item" data-checked={item.checked || undefined}>
      <input
        id={checkboxId}
        className="item__checkbox"
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
      />
      <label className="item__label" htmlFor={checkboxId}>
        <span className="item__box" aria-hidden />
        <span className="item__text">
          <span className="item__name">{item.name}</span>
          {item.quantity && <span className="item__qty">{item.quantity}</span>}
          <span className="item__strike" aria-hidden />
        </span>
      </label>
      <button
        type="button"
        className="icon-button item__edit"
        onClick={() => setEditing(true)}
        aria-label={`Edytuj: ${item.name}`}
      >
        <PencilIcon />
      </button>
    </li>
  );
}

interface ItemEditorProps {
  item: Item;
  onSave: (patch: ItemUpdate) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function ItemEditor({ item, onSave, onCancel, onDelete }: ItemEditorProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const patch: ItemUpdate = {};
    const trimmedName = name.trim();
    const trimmedQty = quantity.trim();
    if (trimmedName && trimmedName !== item.name) patch.name = trimmedName;
    if (trimmedQty !== (item.quantity ?? "")) patch.quantity = trimmedQty || null;
    onSave(patch);
  };

  return (
    <form className="item-editor" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className="item-editor__fields">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          aria-label="Nazwa"
          autoFocus
          required
        />
        <input
          className="field field--qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          maxLength={40}
          aria-label="Ilość"
          placeholder="ile?"
        />
      </div>
      <div className="item-editor__actions">
        <button type="button" className="text-button text-button--danger" onClick={onDelete}>
          Usuń
        </button>
        <span className="spacer" />
        <button type="button" className="text-button" onClick={onCancel}>
          Anuluj
        </button>
        <button type="submit" className="button button--small">
          Zapisz
        </button>
      </div>
    </form>
  );
}
