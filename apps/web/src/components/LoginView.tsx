import { useState, type FormEvent } from "react";

export interface LoginViewProps {
  /** Wejście z linku/QR: inny tekst, bo użytkownik przyszedł do konkretnej listy. */
  joining?: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (displayName: string) => void;
}

export function LoginView({ joining, submitting, error, onSubmit }: LoginViewProps) {
  const [name, setName] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };

  return (
    <main className="login">
      <div className="login__sheet" aria-hidden>
        <span className="login__demo login__demo--done">mleko</span>
        <span className="login__demo">chleb</span>
        <span className="login__demo">pomidory</span>
      </div>
      <h1 className="login__title">Shoplist</h1>
      <p className="login__lead">
        {joining
          ? "Ktoś zaprasza cię do swojej listy zakupów. Podaj imię, żeby dołączyć."
          : "Jedna lista zakupów dla całego domu. Każde odhaczenie widać od razu u wszystkich."}
      </p>
      <form className="login__form" onSubmit={submit}>
        <label className="field-label" htmlFor="display-name">
          Jak masz na imię?
        </label>
        <input
          id="display-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          autoFocus
          required
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button--wide" disabled={submitting || !name.trim()}>
          {joining ? "Dołącz do listy" : "Wejdź"}
        </button>
      </form>
      <p className="login__note">Bez rejestracji i hasła. Imię widzą tylko osoby z twoich list.</p>
    </main>
  );
}
