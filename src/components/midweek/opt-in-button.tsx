"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setMidweekOptOut, type MidweekActionState } from "@/app/(app)/midweek/actions";

/** "Take part again": opting back in is one tap, with no confirmation. */
export function MidweekOptInButton() {
  const [state, formAction, pending] = useActionState<MidweekActionState, FormData>(
    setMidweekOptOut,
    null,
  );
  return (
    <form action={formAction} className="contents">
      <input name="opt_out" type="hidden" value="false" />
      <Button disabled={pending} type="submit">
        {pending ? "Joining…" : "Take part again"}
      </Button>
      {state?.ok === false && (
        <p className="basis-full text-small font-semibold text-brick" role="status">
          {state.error}
        </p>
      )}
    </form>
  );
}
