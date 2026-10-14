"use client";

import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { checkInInjury, type CheckInState } from "./actions";

/** Home's rehab check-in call to action (ADR-082), styled like the report CTA. */
export function InjuryCheckInCard({
  weekStart,
  weekLabel,
  stipend,
}: {
  weekStart: string;
  weekLabel: string;
  stipend: number;
}) {
  const [state, action, pending] = useActionState<CheckInState, FormData>(checkInInjury, null);

  if (state?.ok) {
    return (
      <p className="rounded-2xl border border-moss-line bg-moss-bg p-5 text-small font-semibold text-moss">
        {state.message}
      </p>
    );
  }

  return (
    <Block title="Rehab check-in" tone="now">
      <form action={action} className="grid gap-3">
        <input name="week_start" type="hidden" value={weekStart} />
        <p className="text-small text-ink-dim">
          +{stipend} coins · week of {weekLabel}. Keep your card protected.
        </p>
        {state && !state.ok && (
          <p className="rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
        )}
        <Button disabled={pending} type="submit" wide>
          {pending ? "Checking in…" : "Check in"}
        </Button>
      </form>
    </Block>
  );
}
