"use client";

import { Block } from "@/components/ui/block";
import { Switch } from "@/components/ui/form";
import { Tag } from "@/components/ui/tag";

import { startTransition, useActionState, useId, useState } from "react";
import { setMidweekOptOut, type MidweekActionState } from "@/app/(app)/midweek/actions";
import { optOutConfirmText } from "@/lib/midweek/entry";

/**
 * `MidweekOptOutPanel` on Settings (Settings-TakingPart, Settings-OptedOut).
 * Entry is the default and this switch is the consent (ADR-091): opting out
 * takes two steps because it withdraws a saved five; opting back in is one tap.
 */
export function MidweekOptOutPanel({
  optedOut,
  hasSavedSquadThisWeek,
  locked,
  weekLabel,
  revealAt,
}: {
  optedOut: boolean;
  hasSavedSquadThisWeek: boolean;
  locked: boolean;
  weekLabel: string | null;
  /** The lock in the week's schedule: entered cards are visible from then. */
  revealAt: string;
}) {
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<MidweekActionState, FormData>(
    setMidweekOptOut,
    null,
  );

  function send(optOut: boolean) {
    const formData = new FormData();
    formData.set("opt_out", String(optOut));
    startTransition(() => formAction(formData));
    setConfirming(false);
  }

  function toggle() {
    if (optedOut) send(false);
    else setConfirming(true);
  }

  return (
    <Block
      title="Midweek Madness"
      aside={
        <Switch
          on={!optedOut}
          label="Midweek Madness"
          disabled={pending || confirming}
          onClick={toggle}
        />
      }
    >
      <p role="status">
        <Tag tone={optedOut ? "neutral" : "won"}>
          {optedOut ? "You’ve opted out" : "Taking part"}
        </Tag>
      </p>

      {optedOut ? (
        <p className="text-small text-ink-dim">
          You aren&rsquo;t entered and none of your cards are shown. Switch it back on to be in
          {weekLabel ? ` for ${weekLabel}` : " for the next Wednesday"}, picked or auto.
        </p>
      ) : (
        <ul className="grid list-disc gap-1 pl-5 text-small text-ink-dim marker:text-ink-faint">
          <li>Members see the five you enter, or your auto squad, from {revealAt} on Wednesday.</li>
          <li>The rest of your collection is never shown.</li>
          <li>Opting out takes you out completely.</li>
        </ul>
      )}

      {confirming && !optedOut && (
        <div
          aria-labelledby={confirmId}
          className="grid gap-3 border-t border-dashed border-line pt-4"
          role="group"
        >
          <p className="font-extrabold" id={confirmId}>
            Opt out of Midweek Madness?
          </p>
          <p className="text-small text-ink-dim">
            {optOutConfirmText({ locked, hasSavedSquad: hasSavedSquadThisWeek, weekLabel })}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="inline-flex min-h-11 items-center rounded-[10px] bg-brick px-3.5 text-small font-extrabold text-[#1d0e08]"
              onClick={() => send(true)}
              type="button"
            >
              Opt out
            </button>
            <button
              className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-panel/70 px-3.5 text-small font-extrabold text-ink"
              onClick={() => setConfirming(false)}
              type="button"
            >
              Keep playing
            </button>
          </div>
        </div>
      )}

      {state && (
        <p
          className={`text-small font-semibold ${state.ok ? "text-moss" : "text-brick"}`}
          role="status"
        >
          {state.ok ? state.message : state.error}
        </p>
      )}
    </Block>
  );
}
