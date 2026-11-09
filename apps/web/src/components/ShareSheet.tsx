import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { CloseIcon } from "./Icons";

export interface ShareSheetProps {
  listName: string;
  url: string;
  onClose: () => void;
}

export function ShareSheet({ listName, url, onClose }: ShareSheetProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    // SVG jako data: URI. Ostry przy każdym rozmiarze, czytelny z rzutnika.
    void QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((svg) => {
      if (!cancelled) setQr(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="share"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share__head">
          <h2 id="share-title">Zaproś do listy</h2>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Zamknij">
            <CloseIcon />
          </button>
        </div>
        <p className="share__lead">
          Zeskanuj aparatem telefonu. Każdy, kto ma ten kod, może dołączyć do „{listName}” i edytować listę.
        </p>
        <div className="share__qr">
          {qr ? <img src={qr} alt={`Kod QR z linkiem do listy ${listName}`} /> : <span className="share__qr-placeholder" />}
        </div>
        <div className="share__link">
          <input className="field" value={url} readOnly aria-label="Link do listy" onFocus={(e) => e.target.select()} />
          <button type="button" className="button button--secondary" onClick={copy}>
            {copied ? "Skopiowano" : "Kopiuj link"}
          </button>
        </div>
        {canShare && (
          <button
            type="button"
            className="text-button share__native"
            onClick={() => void navigator.share({ title: listName, url }).catch(() => undefined)}
          >
            Wyślij przez aplikację…
          </button>
        )}
      </div>
    </div>
  );
}
