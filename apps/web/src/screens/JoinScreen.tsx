import { useJoinList } from "@shoplist/core";
import { useEffect, useRef } from "react";

import { navigate, paths } from "../lib/router";
import { StatusPage } from "./ListScreen";

export function JoinScreen({ token }: { token: string }) {
  const { join, error } = useJoinList();
  const started = useRef<string | null>(null);

  useEffect(() => {
    // StrictMode odpala efekt dwa razy. Backend jest idempotentny, ale nie ma po co.
    if (started.current === token) return;
    started.current = token;
    void join(token).then((list) => {
      if (list) navigate(paths.list(list.id), { replace: true });
    });
  }, [join, token]);

  if (error) {
    return (
      <StatusPage
        title="Ten link nie działa"
        body="Lista mogła zostać usunięta albo link jest niepełny. Poproś o nowy kod QR."
      />
    );
  }
  return <StatusPage title="Dołączam do listy…" />;
}
