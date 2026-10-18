"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ARCHETYPES, ARCHETYPE_LABELS } from "@/game/archetypes";
import { addPlayer, type AddPlayerState } from "./actions";

const INPUT = "min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4";

/** A choice of two or three, as radio buttons in segments (#246 S1 `Choice`). */
function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  help,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  help?: ReactNode;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-2 font-semibold">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line/70 bg-board-deep/40 p-1">
        {options.map((option) => (
          <label
            className={`grid min-h-11 cursor-pointer place-items-center rounded-lg px-2 text-center text-small font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass ${option.value === value ? "bg-brass-bg text-brass" : "text-ink-dim"}`}
            key={option.value}
          >
            <input
              checked={option.value === value}
              className="sr-only"
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
      {help && <p className="text-small text-ink-dim">{help}</p>}
    </fieldset>
  );
}

const STAGES = [
  { value: "talent", label: "Talent" },
  { value: "first_team", label: "First Team" },
] as const;
const CREDITS = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
] as const;

/**
 * Add a Player (ADR-165, #246 S1 E6): a Talent (the default, optionally with
 * up to 2 credits) or straight into the First Team. Attendance can still add
 * a Talent on the spot; this is the way without a session.
 */
export function AddPlayerForm() {
  const [state, formAction, isPending] = useActionState(addPlayer, null);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"talent" | "first_team">("talent");
  const [credits, setCredits] = useState<"0" | "1" | "2">("0");

  // Reset the inputs once per successful add, during render (not in an effect)
  // as React recommends for "adjust state when a prop/result changes".
  const [handledSuccess, setHandledSuccess] = useState<AddPlayerState>(null);
  const [formKey, setFormKey] = useState(0);
  if (state?.ok && state !== handledSuccess) {
    setHandledSuccess(state);
    setName("");
    setStage("talent");
    setCredits("0");
    setFormKey((key) => key + 1);
  }

  const talent = stage === "talent";
  const similar = state && !state.ok ? state.similar : undefined;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-line bg-panel p-5"
      key={formKey}
    >
      <h2 className="text-heading font-semibold">Add a Player</h2>
      <label className="block space-y-2">
        <span className="font-semibold">Display name</span>
        <input
          className={INPUT}
          maxLength={80}
          name="display_name"
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Jip W."
          required
          value={name}
        />
      </label>
      {similar && (
        <div className="space-y-3 rounded-xl border border-warning-line bg-warning-bg/55 p-3 text-small text-ink-dim">
          <p>
            <b className="text-warning">Is this {similar}?</b> Open their row below instead (give
            them a credit, or tick them in attendance), or add a different name (e.g. &ldquo;
            {name.trim() || "Jip"} B.&rdquo;).
          </p>
          <label className="flex min-h-11 items-center gap-3 font-semibold text-ink">
            <input className="h-5 w-5 accent-brass" name="allow_similar" type="checkbox" />
            It&rsquo;s a different person: add them anyway
          </label>
        </div>
      )}
      <Choice
        help={
          talent
            ? "In the Academy, without a card. Promoted after 3 of the last 8 counted weeks."
            : "A Live card in packs straight away, at 30 OVR (Common) until their first published attendance."
        }
        legend="Starts as"
        name="stage"
        onChange={setStage}
        options={STAGES}
        value={stage}
      />
      <label className="block space-y-2">
        <span className="font-semibold">Archetype</span>
        <select className={INPUT} defaultValue="all_rounder" name="archetype">
          {ARCHETYPES.map((value) => (
            <option key={value} value={value}>
              {ARCHETYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      {talent && (
        <>
          <Choice
            help="Each counts as a week towards promotion and expires after 8 counted weeks. Up to 2 active."
            legend="Credits to start with"
            name="credits"
            onChange={setCredits}
            options={CREDITS}
            value={credits}
          />
          {credits !== "0" && (
            <label className="block space-y-2">
              <span className="font-semibold">Reason for the credits</span>
              <input
                className={INPUT}
                maxLength={200}
                minLength={3}
                name="credit_reason"
                placeholder="e.g. trained with us all summer"
                required
              />
            </label>
          )}
        </>
      )}
      <label className="block space-y-2">
        <span className="font-semibold">Full name</span>
        <input className={INPUT} maxLength={120} name="full_name" />
        <span className="block text-small text-ink-faint">
          Optional. Kept for admin reference only.
        </span>
      </label>
      {state && !state.ok && !state.similar && (
        <p className="rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-xl bg-moss-bg p-3 text-small text-moss">
          Added {state.player.display_name}{" "}
          {state.player.stage === "talent"
            ? `as a Talent${state.player.credits ? ` with ${state.player.credits} ${state.player.credits === 1 ? "credit" : "credits"}` : ""}`
            : "to the First Team"}{" "}
          (slug: {state.player.slug}).
        </p>
      )}
      <button
        className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-semibold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? "Adding…"
          : talent
            ? credits === "0"
              ? "Add Talent"
              : `Add Talent with ${credits} ${credits === "1" ? "credit" : "credits"}`
            : "Add to the First Team"}
      </button>
    </form>
  );
}
