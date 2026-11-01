"use server";

import { revalidatePath } from "next/cache";
import { countNoun, formatReportedCount } from "@/game/reported-count";
import { requireUser } from "@/lib/auth/user";
import { ballotPayload, type Ballot } from "@/lib/session-reports/kudos-ballot";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type ReportState = {
  error: string | null;
  saved?: boolean;
  rewarded?: boolean;
  revision?: number;
  savedValues?: { goals: number; ballot: Ballot };
};

export async function saveSessionReport(
  previous: ReportState,
  formData: FormData,
): Promise<ReportState> {
  await requireUser();
  // Keep the last successful baseline and revision when a later save fails.
  const fail = (error: string): ReportState => ({ ...previous, error, saved: false });
  const sessionId = String(formData.get("sessionId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const revision = Number(formData.get("revision"));
  const rawGoals = String(formData.get("goals") ?? "").trim();
  const goals = rawGoals === "" ? null : Number(rawGoals);
  if (
    !isUuid(sessionId) ||
    !isUuid(idempotencyKey) ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    (goals !== null && (!Number.isInteger(goals) || goals < 0 || goals > 99))
  )
    return fail("Check the report fields and try again.");
  if (goals === null)
    return fail(
      `Enter your ${countNoun(String(formData.get("sessionDate") ?? ""))} (including zero) before submitting.`,
    );
  if (goals >= 10 && formData.get("confirmGoals") !== "yes")
    // The date only chooses the wording ("goals" or "G+A", ADR-101); nothing is
    // scored from it, so a client-supplied value cannot change the outcome.
    return fail(
      `Confirm ${formatReportedCount(goals, String(formData.get("sessionDate") ?? ""))} before submitting.`,
    );
  const categoryIds = String(formData.get("categoryIds") ?? "")
    .split(",")
    .filter(Boolean);
  const ballot: Ballot = Object.fromEntries(
    categoryIds.map((categoryId) => [
      categoryId,
      String(formData.get(`category-${categoryId}`) ?? ""),
    ]),
  );
  // Historical drafts remain readable, but the member action only submits.
  const payload = ballotPayload(categoryIds, ballot, "submit");
  if (!payload.ok) return fail(`${payload.error} Refresh if the form looks out of date.`);
  const supabase = await createClient();
  let response;
  try {
    response = await supabase.schema("kut").rpc("submit_session_report", {
      p_session_id: sessionId,
      p_goals: goals,
      p_nominations: payload.nominations,
      p_expected_revision: revision,
      p_idempotency_key: idempotencyKey,
      p_intent: "submit",
    });
  } catch {
    return fail("Could not save the report. Check your connection and try again.");
  }
  const { data, error } = response;
  if (error)
    return fail(
      error.message.includes("closed")
        ? "Reports are closed for this session."
        : error.message.includes("only once")
          ? "Choose a different teammate in each category."
          : error.message.includes("Skip")
            ? "Choose a teammate or Skip in every kudos category."
            : "Could not save the report. Refresh and try again.",
    );
  if (data && typeof data === "object" && "conflict" in data && data.conflict)
    return fail("This report changed elsewhere. Refresh to load the saved version.");
  if (!data || typeof data !== "object" || !("revision" in data))
    return fail("Could not confirm the save. Refresh to check your report before trying again.");
  revalidatePath(`/sessions/${sessionId}/report`);
  revalidatePath("/");
  return {
    error: null,
    saved: true,
    rewarded: Boolean(data && typeof data === "object" && "rewarded" in data && data.rewarded),
    revision: Number(data.revision),
    savedValues: { goals, ballot },
  };
}
