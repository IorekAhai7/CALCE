"use client";
import { useActionState, useId, type ReactNode } from "react";
import type { ActionState } from "@/modules/cases/actions";
export function ActionForm({
  action,
  children,
  submit = "Guardar",
  className = "",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submit?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    ok: false,
    message: "",
  });
  const messageId = useId();
  return (
    <form
      action={formAction}
      className={className}
      aria-describedby={messageId}
    >
      <fieldset disabled={pending}>
        {children}
        <button type="submit">{pending ? "Guardando…" : submit}</button>
      </fieldset>
      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className={state.ok ? "success" : "error"}
      >
        {state.message}
      </p>
    </form>
  );
}
