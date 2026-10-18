"use client";

import { useActionState, useState } from "react";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ACADEMY, weekLabelLong } from "@/lib/academy";
import { recordAcademyGoLive, type RosterActionState } from "./actions";

/**
 * The Academy's go-live (ADR-165, #246 S1 E4): brass while due, then a
 * confirmation that says what starts. Always the current football week; it
 * can't be backdated or undone.
 */
export function GoLiveBlock({ goLive }: { goLive: string | null }) {
  const [state, formAction, isPending] = useActionState<RosterActionState, FormData>(
    recordAcademyGoLive,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (goLive) {
    return (
      <Block aside={<Tag tone="won">Live</Tag>} title="Academy">
        <p className="text-body text-ink-dim">
          Live since the week of {weekLabelLong(goLive)}. Promotions, warnings and retirements
          follow each publish.
        </p>
        {state?.ok && <p className="text-small text-moss">{state.message}</p>}
      </Block>
    );
  }

  return (
    <Block aside={<Tag>Off</Tag>} title={confirming ? "Go live this week?" : "Academy"} tone="now">
      {confirming ? (
        <form action={formAction} className="grid gap-3">
          <p className="text-body text-ink-dim">
            The Academy starts in this football week. It can&rsquo;t be backdated or undone.
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-body text-ink-dim">
            <li>Members see the Academy, stages and the Retired set.</li>
            <li>
              Clocks start now: nobody is At risk for {ACADEMY.atRiskWeeks} counted weeks, or
              Retired for {ACADEMY.retireWeeks}.
            </li>
            <li>Promotions and messages follow each publish.</li>
          </ul>
          {state && !state.ok && (
            <p className="rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button disabled={isPending} type="submit">
              {isPending ? "Going live…" : "Go live this week"}
            </Button>
            <Button disabled={isPending} kind="secondary" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-body text-ink-dim">
            Off: members see no Academy, stages or Retired set yet. You can already add Talents and
            give them credits below, and mark unlinked Players injured.
          </p>
          <div>
            <Button onClick={() => setConfirming(true)}>Go live this week</Button>
          </div>
        </>
      )}
    </Block>
  );
}
