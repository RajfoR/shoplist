import { useAuth } from "@shoplist/core";
import { useState } from "react";

import { LoginView } from "../components/LoginView";
import { describeError } from "../lib/errors";

export function LoginScreen({ joining }: { joining?: boolean }) {
  const { loginAsGuest } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (name: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await loginAsGuest(name);
    } catch (err) {
      setError(describeError(err as Error, { rolledBack: false }));
      setSubmitting(false);
    }
  };

  return <LoginView joining={joining} submitting={submitting} error={error} onSubmit={submit} />;
}
