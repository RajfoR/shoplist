import { ApiError, NetworkError } from "@shoplist/core";

/**
 * Komunikat dla użytkownika po nieudanej operacji na liście.
 * Core robi wtedy rollback, więc mówimy wprost, że zmiana wróciła.
 */
export function describeError(error: Error): string {
  if (error instanceof NetworkError) return "Brak połączenia z serwerem. Zmiana została cofnięta.";
  if (error instanceof ApiError) {
    if (error.status === 403) return "Tylko właściciel może usunąć tę listę.";
    if (error.status === 404) return "Tego już nie ma: ktoś usunął to przed chwilą.";
    if (error.status === 422) return "Sprawdź wpisaną nazwę: jest pusta albo za długa.";
  }
  return "Coś poszło nie tak. Zmiana została cofnięta.";
}