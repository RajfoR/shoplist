import { useRef, useState, type FormEvent } from "react";

export interface AddItemFormProps {
  onAdd: (name: string, quantity: string | null) => void;
  disabled?: boolean;
}

export function AddItemForm({ onAdd, disabled }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, quantity.trim() || null);
    setName("");
    setQuantity("");
    // Fokus zostaje w polu: dodawanie kilku rzeczy pod rząd bez dotykania ekranu.
    nameRef.current?.focus();
  };

  return (
    <form className="add-item" onSubmit={submit}>
      <input
        ref={nameRef}
        className="field add-item__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Co kupić?"
        aria-label="Co kupić?"
        maxLength={120}
        enterKeyHint="done"
        disabled={disabled}
      />
      <input
        className="field field--qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="ile?"
        aria-label="Ilość"
        maxLength={40}
        disabled={disabled}
      />
      <button type="submit" className="button" disabled={disabled || !name.trim()}>
        Dodaj
      </button>
    </form>
  );
}
