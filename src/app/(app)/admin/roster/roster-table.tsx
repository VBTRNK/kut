"use client";

import { useActionState } from "react";
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
};

export function RosterTable({ players, today }: { players: RosterRow[]; today: string }) {
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
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Archetype</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Injury</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className="border-b border-line/50 last:border-0" key={player.id}>
                <td className="px-4 py-3 font-semibold">{player.display_name}</td>
                <td className="px-4 py-3 text-ink-dim">{player.slug}</td>
                <td className="px-4 py-3 text-ink-dim">{player.archetype}</td>
                <td className="px-4 py-3 text-ink-dim">{player.is_active ? "y" : "n"}</td>
                <td className="px-4 py-3 align-top">
                  <InjuryCell
                    formAction={formAction}
                    isPending={isPending}
                    player={player}
                    today={today}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
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
        week. It ends by itself when they play a published session again. The note is visible to
        admins only.
      </p>
    </div>
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

  if (!player.has_account || !player.is_active) {
    return <span className="text-label text-ink-faint">Needs an active account</span>;
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
