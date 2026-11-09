import { ApiError, NetworkError } from "@shoplist/core";

/**
 * Komunikat dla użytkownika. Operacje na liście w core robią rollback, więc
 * domyślnie dopisujemy, że zmiana wróciła. Dla logowania i tworzenia list
 * (`rolledBack: false`) nie ma czego cofać.
 */
export function describeError(error: Error, { rolledBack = true } = {}): string {
  const suffix = rolledBack ? " Zmiana została cofnięta." : "";
  if (error instanceof NetworkError) return `Brak połączenia z serwerem.${suffix}`;
  if (error instanceof ApiError) {
    if (error.status === 403) return "Tylko właściciel może usunąć tę listę.";
    if (error.status === 404) return "Tego już nie ma: ktoś usunął to przed chwilą.";
    if (error.status === 422) return "Sprawdź wpisaną nazwę: jest pusta albo za długa.";
    if (error.status >= 500) return `Serwer ma problem.${suffix}`;
  }
  return `Coś poszło nie tak.${suffix}`;
}
