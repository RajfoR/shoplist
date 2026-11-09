import type { ConnectionStatus } from "@shoplist/core";

const LABEL: Record<ConnectionStatus, string> = {
  open: "Na żywo",
  connecting: "Łączę…",
  closed: "Brak połączenia",
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className="connection" data-status={status} role="status">
      <span className="connection__dot" aria-hidden />
      {LABEL[status]}
    </span>
  );
}
