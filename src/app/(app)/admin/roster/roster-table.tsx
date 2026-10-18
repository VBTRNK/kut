"use client";

import { useActionState } from "react";
import { Tag, type TagTone } from "@/components/ui/tag";
import { ACADEMY, footballWeek, progressWords, weekLabel, type LifecycleRow } from "@/lib/academy";
import { formatDate } from "@/lib/format";
import { manageRoster, type RosterActionState } from "./actions";

export type RosterRow = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  is_active: boolean;
  has_history: boolean;
  /** Linked to an active (not disabled) account. */
  has_account: boolean;
  /** ADR-082. null: not injured. undefined: the injury read failed. */
  injury: { started_on: string; protected_weeks: number } | null | undefined;
  /** ADR-165: the stage and clocks; null when the read failed or isn't there yet. */
  lifecycle: LifecycleRow | null;
  /** Credits ever granted, newest first (admins only). */
  credits: { granted_week: string; reason: string }[];
};

/** The Stage column (#246 S1 E3): a word, so colour is never the only signal. */
function stageTag(row: LifecycleRow, live: boolean): { tone: TagTone; text: string } {
  if (row.lifecycle_stage === "talent") return { tone: "auto", text: "Talent" };
  if (row.lifecycle_stage === "retired") return { tone: "out", text: "Retired" };
  if (live && row.promoted_week === footballWeek(new Date()))
    return { tone: "won", text: "Promoted" };
  if (row.at_risk) return { tone: "warn", text: "At risk" };
  return { tone: "neutral", text: "First Team" };
}

/** The Clock column: progress for a Talent or comeback, the absence clock otherwise. */
function clockText(player: RosterRow, row: LifecycleRow): string {
  const words = progressWords(row.progress_weeks, row.progress_credits);
  if (row.lifecycle_stage === "talent")
    return `${words}${row.academy_visible ? "" : " · not shown"}`;
  if (row.lifecycle_stage === "retired")
    return `${row.retired_week ? `Since ${weekLabel(row.retired_week)} · ` : ""}comeback ${row.progress} of ${ACADEMY.promoteAt}`;
  if (row.absent_weeks === null) return "Starts at go-live";
  if (player.injury) return "Paused (injured)";
  return row.absent_weeks === 0
    ? "Played recently"
    : `${row.absent_weeks} ${row.absent_weeks === 1 ? "week" : "weeks"} away`;
}

export function RosterTable({
  players,
  today,
  academy,
  goLive,
}: {
  players: RosterRow[];
  today: string;
  /** The Academy columns read; false hides them rather than failing the roster. */
  academy: boolean;
  goLive: string | null;
}) {
  const [state, formAction, isPending] = useActionState<RosterActionState, FormData>(
    manageRoster,
    null,
  );

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-heading">Current roster ({players.length})</h2>
      {state && !state.ok && (
        <p className="rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-xl bg-moss-bg p-3 text-small text-moss">{state.message}</p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full text-left text-small">
          <thead className="text-label font-semibold text-ink-faint">
            <tr className="border-b border-line">
              <th className="px-4 py-3">Display name</th>
              {academy && <th className="px-4 py-3">Stage</th>}
              {academy && <th className="px-4 py-3">Clock</th>}
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Injury</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className="border-b border-line/50 last:border-0" key={player.id}>
                <td className="px-4 py-3">
                  <span className="block font-semibold whitespace-nowrap">
                    {player.display_name}
                  </span>
                  <span className="block text-label text-ink-faint">
                    {player.slug} · {player.archetype}
                  </span>
                </td>
                {academy && (
                  <td className="px-4 py-3">
                    {player.lifecycle && (
                      <Tag tone={stageTag(player.lifecycle, Boolean(goLive)).tone}>
                        {stageTag(player.lifecycle, Boolean(goLive)).text}
                      </Tag>
                    )}
                  </td>
                )}
                {academy && (
                  <td className="px-4 py-3 text-ink-dim whitespace-nowrap">
                    {player.lifecycle ? clockText(player, player.lifecycle) : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-ink-dim">{player.is_active ? "y" : "n"}</td>
                <td className="px-4 py-3 align-top">
                  <InjuryCell
                    formAction={formAction}
                    isPending={isPending}
                    player={player}
                    today={today}
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    {academy &&
                      player.lifecycle &&
                      player.lifecycle.lifecycle_stage !== "first_team" && (
                        <AcademyActions
                          formAction={formAction}
                          isPending={isPending}
                          player={player}
                          row={player.lifecycle}
                        />
                      )}
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="toggle" />
                      <input name="player_id" type="hidden" value={player.id} />
                      <input
                        name="is_active"
                        type="hidden"
                        value={player.is_active ? "false" : "true"}
                      />
                      <button
                        className="min-h-11 rounded-lg border border-line px-3 py-1.5 text-label font-semibold text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isPending}
                        type="submit"
                      >
                        {player.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                    <form
                      action={formAction}
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Permanently delete ${player.display_name}? This cannot be undone.`,
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input name="intent" type="hidden" value="delete" />
                      <input name="player_id" type="hidden" value={player.id} />
                      <button
                        className="min-h-11 rounded-lg border border-brick-line/60 px-3 py-1.5 text-label font-semibold text-brick hover:bg-brick-bg disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isPending || player.has_history}
                        title={
                          player.has_history
                            ? "Has attendance or a linked account — deactivate instead"
                            : undefined
                        }
                        type="submit"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-small text-ink-faint">
        Deactivating hides a player from Live Ratings and pack pools but keeps their history and any
        cards people own — it is reversible. Delete is permanent and only goes through for a player
        with no attendance, account, invite, or owned cards.
      </p>
      <p className="text-small text-ink-faint">
        Injury mode protects a long-term injured player&rsquo;s card: each football week they sit
        out, they check in from Home for 100 FLUT Coins and their rating doesn&rsquo;t drop that
        week. It ends by itself when they play a published session again. A Player without an
        account can be injured too: that pauses their absence clock and puts their card in plaster,
        with no check-in. The note is visible to admins only.
      </p>
      {academy && (
        <p className="text-small text-ink-faint">
          A credit counts as one week towards promotion, never as attendance, rating or coins. A
          Player holds up to {ACADEMY.maxCredits} active; each expires after {ACADEMY.windowWeeks}{" "}
          counted weeks. Promote gives a Talent a Live card in packs now; Bring back puts a Retired
          Player&rsquo;s existing card back in packs and Midweek. Both are permanent and keep the
          Player ID.
        </p>
      )}
    </div>
  );
}

/** Credit and Promote / Bring back for a Talent or a Retired Player (#246 S1 E5). */
function AcademyActions({
  player,
  row,
  formAction,
  isPending,
}: {
  player: RosterRow;
  row: LifecycleRow;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}) {
  const talent = row.lifecycle_stage === "talent";
  const full = row.progress_credits >= ACADEMY.maxCredits;
  return (
    <details className="min-w-56 text-left">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-3 text-label font-semibold whitespace-nowrap text-ink-dim hover:text-ink">
        {talent ? "Credit · Promote" : "Credit · Bring back"}
      </summary>
      <div className="mt-2 space-y-3 rounded-lg border border-line bg-panel-2 p-3">
        <p className="text-label text-ink-dim">
          {progressWords(row.progress_weeks, row.progress_credits)}{" "}
          {talent ? "towards promotion" : "towards a comeback"}
        </p>
        {player.credits.length > 0 && (
          <ul className="space-y-1 text-label text-ink-faint">
            {player.credits.slice(0, 4).map((credit, index) => (
              <li key={index}>
                Credit given {weekLabel(credit.granted_week)}: {credit.reason}
              </li>
            ))}
          </ul>
        )}
        <form action={formAction} className="space-y-2">
          <input name="intent" type="hidden" value="credit" />
          <input name="player_id" type="hidden" value={player.id} />
          <input
            aria-label={`Reason for a credit for ${player.display_name}`}
            className={INPUT}
            disabled={full}
            maxLength={200}
            minLength={3}
            name="reason"
            placeholder="Reason, e.g. played the away friendly"
            required
          />
          <button
            className={BUTTON}
            disabled={isPending || full || !player.is_active}
            type="submit"
          >
            Give a credit ({row.progress_credits} of {ACADEMY.maxCredits})
          </button>
        </form>
        <form
          action={formAction}
          onSubmit={(event) => {
            const question = talent
              ? `Promote ${player.display_name} to the First Team? Their Live card goes into packs now. This is permanent.`
              : `Bring ${player.display_name} back to the First Team? Their existing card goes back into packs and Midweek now.`;
            if (!window.confirm(question)) event.preventDefault();
          }}
        >
          <input name="intent" type="hidden" value="promote" />
          <input name="player_id" type="hidden" value={player.id} />
          <button className={BUTTON} disabled={isPending || !player.is_active} type="submit">
            {talent ? "Promote" : "Bring back"}
          </button>
        </form>
        {!player.is_active && (
          <p className="text-label text-ink-faint">Reactivate the Player first.</p>
        )}
      </div>
    </details>
  );
}

const INPUT = "min-h-11 w-full rounded-lg border border-line bg-panel-2 px-2 text-label text-ink";
const BUTTON =
  "min-h-11 rounded-lg border border-line px-3 py-1.5 text-label font-semibold text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";

function InjuryCell({
  player,
  today,
  formAction,
  isPending,
}: {
  player: RosterRow;
  today: string;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}) {
  if (player.injury === undefined) return <span className="text-ink-faint">—</span>;

  if (player.injury) {
    const weeks = player.injury.protected_weeks;
    return (
      <details className="min-w-44">
        <summary className="min-h-11 cursor-pointer text-label font-semibold text-brick">
          Injured since {formatDate(player.injury.started_on)} · {weeks}{" "}
          {weeks === 1 ? "week" : "weeks"} protected
        </summary>
        <form action={formAction} className="mt-2 space-y-2">
          <input name="intent" type="hidden" value="end_injury" />
          <input name="player_id" type="hidden" value={player.id} />
          <input
            aria-label="Reason for ending injury mode"
            className={INPUT}
            maxLength={200}
            minLength={3}
            name="reason"
            placeholder="Reason, e.g. fit again"
            required
          />
          <button className={BUTTON} disabled={isPending} type="submit">
            End injury mode
          </button>
        </form>
      </details>
    );
  }

  return (
    <details className="min-w-44">
      <summary className="min-h-11 cursor-pointer text-label font-semibold text-ink-dim">
        Mark injured…
      </summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input name="intent" type="hidden" value="start_injury" />
        <input name="player_id" type="hidden" value={player.id} />
        <label className="block space-y-1 text-label text-ink-faint">
          <span>Injury date</span>
          <input
            className={INPUT}
            defaultValue={today}
            max={today}
            name="started_on"
            required
            type="date"
          />
        </label>
        <input
          aria-label="Private note (admins only)"
          className={INPUT}
          maxLength={200}
          name="note"
          placeholder="Private note (admins only)"
        />
        <button className={BUTTON} disabled={isPending} type="submit">
          Start injury mode
        </button>
      </form>
    </details>
  );
}
