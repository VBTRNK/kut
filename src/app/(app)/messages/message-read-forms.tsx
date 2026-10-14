"use client";

import { useActionState } from "react";
import { markMessagesRead, type MessageActionState } from "./actions";

const initialState: MessageActionState = { error: null };

export function MarkAllMessagesReadForm() {
  const [state, formAction, pending] = useActionState(markMessagesRead, initialState);
  return (
    <form action={formAction}>
      <input name="all" type="hidden" value="1" />
      {state.error && <p className="mb-2 text-small text-brick">{state.error}</p>}
      <button
        className="min-h-11 rounded-xl border border-line bg-panel px-4 text-body font-semibold text-ink hover:border-brass-line disabled:text-ink-faint"
        disabled={pending}
        type="submit"
      >
        {pending ? "Updating..." : "Mark all read"}
      </button>
    </form>
  );
}
