export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="toast" role="alert">
      <span>{message}</span>
      <button type="button" className="text-button toast__close" onClick={onDismiss}>
        OK
      </button>
    </div>
  );
}
