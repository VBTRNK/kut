"use client";

import { Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { useActionState } from "react";
import { saveClubName, type SettingsActionState } from "./actions";

function Feedback({ state }: { state: SettingsActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-xl bg-moss-bg p-3 text-small font-semibold text-moss">{state.message}</p>
  ) : (
    <p className="rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
  );
}

export function ClubNameForm({
  currentName,
  defaultName,
}: {
  currentName: string | null;
  defaultName: string;
}) {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    saveClubName,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <Field
        label="Club name"
        defaultValue={currentName ?? ""}
        maxLength={80}
        name="club_name"
        placeholder={defaultName}
        help={`Shown in the standings and on Midweek. Leave it blank for ${defaultName}.`}
      />
      <Feedback state={state} />
      <Button kind="secondary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save club name"}
      </Button>
    </form>
  );
}
