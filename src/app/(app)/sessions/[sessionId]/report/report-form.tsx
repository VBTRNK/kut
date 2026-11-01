"use client";

import { startTransition, useActionState, useState } from "react";
import { Tag } from "@/components/ui/tag";
import {
  SAFE_HANDS_CATEGORY_ID,
  SKIP,
  UNDECIDED,
  duplicateNominees,
  seedBallot,
  undecidedCategories,
  type Ballot,
} from "@/lib/session-reports/kudos-ballot";
import { countQuestion, formatReportedCount, reportsGoalsAndAssists } from "@/game/reported-count";
import { saveSessionReport, type ReportState } from "./actions";

type Category = { id: string; title: string; description: string };
type Attendee = { player_id: string; display_name: string };
const initial: ReportState = { error: null };

export function ReportForm({
  sessionId,
  sessionDate,
  playerId,
  categories,
  attendees,
  goals: initialGoals,
  revision,
  rewardReceived,
  reportStatus,
  savedNominations,
  explicitSkips,
}: {
  sessionId: string;
  sessionDate: string;
  playerId: string;
  categories: Category[];
  attendees: Attendee[];
  goals: number | null;
  revision: number;
  rewardReceived: boolean;
  reportStatus: string | null;
  savedNominations: Record<string, string>;
  explicitSkips: string[];
}) {
  // From the week of 28 Sep 2026 the one number is goals and assists combined;
  // an older session keeps asking for goals (ADR-101).
  const combined = reportsGoalsAndAssists(sessionDate);
  const hasSafeHands = categories.some((category) => category.id === SAFE_HANDS_CATEGORY_ID);
  const categoryIds = categories.map((category) => category.id);
  const [goals, setGoals] = useState(initialGoals === null ? "" : String(initialGoals));
  // Every field is React-controlled on purpose. A <form action={fn}> is reset by
  // React once the action settles, and a reset restores each control to the
  // default it was *mounted* with — React never re-applies a changed
  // `defaultValue` to a <select>. Uncontrolled kudos selects therefore snapped
  // back to their opening option on every save (ADR-068 / KB-015).
  const [ballot, setBallot] = useState<Ballot>(() =>
    seedBallot(categoryIds, savedNominations, explicitSkips),
  );
  const [state, action, pending] = useActionState(saveSessionReport, initial);
  const [openingValues] = useState(() => ({ goals: initialGoals, ballot }));
  const savedValues = state.savedValues ?? openingValues;
  const submitted = reportStatus === "submitted" || rewardReceived || !!state.savedValues;
  const changed =
    (goals === "" ? null : Number(goals)) !== savedValues.goals ||
    categoryIds.some((id) => ballot[id] !== savedValues.ballot[id]);
  const [confirmedGoals, setConfirmedGoals] = useState<string | null>(null);
  const effectiveRevision = state.revision ?? revision;
  // Dispatched from onSubmit rather than through `action={...}`, because React
  // resets a form with a function action once that action settles. A reset
  // restores every control to its mount-time default, and while React re-syncs
  // a controlled <input> past that (it keeps the element's defaultValue equal
  // to the current value) it does not do the same for a <select> — so the
  // kudos picks were wiped on every save even once controlled.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || incomplete || (submitted && !changed)) return;
    const formData = new FormData(
      event.currentTarget,
      (event.nativeEvent as SubmitEvent).submitter,
    );
    formData.set("idempotencyKey", crypto.randomUUID());
    startTransition(() => action(formData));
  }
  const highGoals = /^\d+$/.test(goals) && Number(goals) >= 10;
  const validGoals = /^\d+$/.test(goals) && Number(goals) <= 99;
  const undecided = undecidedCategories(categoryIds, ballot);
  const duplicates = new Set(duplicateNominees(categoryIds, ballot));
  const nameOf = new Map(attendees.map((a) => [a.player_id, a.display_name]));
  const blocker =
    duplicates.size > 0
      ? `Choose a different teammate in each category — ${[...duplicates]
          .map((id) => nameOf.get(id) ?? "that teammate")
          .join(" and ")} ${duplicates.size > 1 ? "are" : "is"} picked twice.`
      : !validGoals
        ? `Enter your ${combined ? "G+A" : "goals"} (0–99, including zero) before submitting.`
        : highGoals && confirmedGoals !== goals
          ? `Confirm ${formatReportedCount(Number(goals), sessionDate)} before submitting.`
          : null;
  const incomplete = blocker !== null || undecided.length > 0;
  return (
    <form
      className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start"
      onSubmit={submit}
    >
      <input name="sessionId" type="hidden" value={sessionId} />
      <input name="sessionDate" type="hidden" value={sessionDate} />
      <input name="revision" type="hidden" value={effectiveRevision} />
      <input name="categoryIds" type="hidden" value={categoryIds.join(",")} />
      <fieldset
        aria-labelledby="reported-count-question"
        className="space-y-3 rounded-2xl border border-line/60 bg-panel/60 p-4 md:col-start-1"
      >
        <h2 className="font-semibold text-heading" id="reported-count-question">
          {countQuestion(sessionDate)}
        </h2>
        {combined && (
          <p className="text-small text-ink-dim">
            One number: goals + assists. 2 goals + 2 assists = 4.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <button
              className={`min-h-11 min-w-11 rounded-xl border font-extrabold ${goals === String(value) ? "border-brass bg-brass text-ink-on-accent" : "border-line bg-panel"}`}
              key={value}
              onClick={() => setGoals(String(value))}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-small font-semibold">
          6 or more
          <input
            className="min-h-11 w-24 rounded-xl border border-line bg-panel px-3 text-body"
            max="99"
            min="0"
            name="goals"
            onChange={(e) => setGoals(e.target.value)}
            type="number"
            value={goals}
          />
        </label>
        {highGoals && (
          <label className="flex min-h-11 items-center gap-3 text-small font-semibold">
            <input
              checked={confirmedGoals === goals}
              name="confirmGoals"
              onChange={(event) => setConfirmedGoals(event.target.checked ? goals : null)}
              type="checkbox"
              value="yes"
            />
            Confirm {formatReportedCount(Number(goals), sessionDate)}
          </label>
        )}
      </fieldset>
      <fieldset className="min-w-0 space-y-3 md:col-start-2 md:row-span-2 md:row-start-1">
        <legend className="font-semibold text-heading">Give kudos</legend>
        <p className="text-small text-ink-dim">
          {hasSafeHands
            ? "Choose different teammates for the three rotating categories. Safe Hands may repeat a pick. Choose or Skip each one."
            : "Choose a different teammate in each category, or explicitly Skip."}{" "}
          Unanswered is not a Skip. Complete every category before submitting.
        </p>
        {categories.map((category) => {
          const choice = ballot[category.id] ?? UNDECIDED;
          const safeHands = category.id === SAFE_HANDS_CATEGORY_ID;
          const duplicated = !safeHands && duplicates.has(choice);
          return (
            <section
              className={
                safeHands
                  ? "mt-4 rounded-2xl border border-brass-line bg-brass-bg p-3"
                  : "rounded-2xl border bg-panel/60 p-3 " +
                    (duplicated ? "border-brick-line" : "border-line")
              }
              key={category.id}
              aria-label={category.title}
            >
              <div className="grid items-center gap-2 sm:grid-cols-2 sm:gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="font-extrabold" htmlFor={"category-" + category.id}>
                      {category.title}
                    </label>
                    {safeHands && <Tag tone="you">Every session</Tag>}
                  </div>
                  <p className="mt-1 text-label text-ink-dim" id={"description-" + category.id}>
                    {category.description}
                  </p>
                </div>
                <select
                  className="min-h-11 w-full rounded-xl border border-line bg-board px-3 text-body"
                  id={"category-" + category.id}
                  aria-describedby={"description-" + category.id}
                  aria-invalid={duplicated || undefined}
                  name={"category-" + category.id}
                  onChange={(e) =>
                    setBallot((current) => ({ ...current, [category.id]: e.target.value }))
                  }
                  value={choice}
                >
                  <option value={UNDECIDED}>Choose a teammate…</option>
                  {attendees
                    .filter((a) => a.player_id !== playerId)
                    .map((a) => (
                      <option key={a.player_id} value={a.player_id}>
                        {a.display_name}
                      </option>
                    ))}
                  <option value={SKIP}>Skip this category</option>
                </select>
              </div>
              {safeHands && (
                <>
                  <p className="mt-2 text-label text-ink-dim">
                    You can pick someone you also nominated above.
                  </p>
                  <details className="mt-1 text-label text-ink-dim">
                    <summary className="min-h-11 content-center cursor-pointer text-brass">
                      How Safe Hands is awarded
                    </summary>
                    <p className="mt-1">
                      One winner across both teams: the outright leader with at least two distinct
                      nominators and at least three reporters giving kudos. Tied leaders receive no
                      award. It counts as one ordinary kudos category: 0 / 1 / 1.5 / 2 Form for 0 /
                      1 / 2 / 3+ recognised categories.
                    </p>
                  </details>
                </>
              )}
              {duplicated && (
                <p className="mt-2 text-label font-semibold text-brick">
                  Already picked in another rotating category.
                </p>
              )}
            </section>
          );
        })}
      </fieldset>
      <div className="grid gap-3 md:col-start-1 md:row-start-2">
        <p
          className={`text-small ${state.saved && !changed ? "font-semibold text-moss" : "text-ink-dim"}`}
          role="status"
        >
          {changed && submitted
            ? "You have unsaved changes."
            : state.saved
              ? state.rewarded
                ? "Report submitted → +50 FLUT Coins received."
                : "Report submitted. Your changes are saved. Edits never pay twice."
              : submitted
                ? "Report submitted. No unsaved changes. Edits never pay twice."
                : "First complete report: +50 FLUT Coins. Edits never pay twice."}
        </p>
        {(state.error || blocker) && (
          <p
            className={`text-small font-semibold ${state.error ? "text-brick" : "text-ink-dim"}`}
            role={state.error ? "alert" : "status"}
          >
            {state.error ?? blocker}
          </p>
        )}
        {undecided.length > 0 && (
          <div className="text-small text-ink-dim" role="status">
            <p>Choose a teammate or Skip in each unanswered category:</p>
            <ul>
              {categories
                .filter((category) => undecided.includes(category.id))
                .map((category) => (
                  <li key={category.id}>
                    <button
                      className="min-h-11 text-left font-semibold text-brass underline"
                      onClick={() => document.getElementById("category-" + category.id)?.focus()}
                      type="button"
                    >
                      {category.title}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3">
          <button
            className="min-h-13 rounded-xl bg-brass font-extrabold text-ink-on-accent disabled:opacity-50"
            disabled={pending || incomplete || (submitted && !changed)}
            name="intent"
            type="submit"
            value="submit"
          >
            {pending ? "Saving…" : submitted ? "Save changes" : "Submit report"}
          </button>
        </div>
      </div>
    </form>
  );
}
