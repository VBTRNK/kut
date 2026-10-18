"use server";

import { revalidatePath } from "next/cache";
import { isArchetype } from "@/game/archetypes";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type AddPlayerState =
  | { ok: true; player: { slug: string; display_name: string; stage: string; credits: number } }
  | { ok: false; error: string; similar?: string }
  | null;

export type RosterActionState = { ok: true; message: string } | { ok: false; error: string } | null;

function revalidateRoster() {
  revalidatePath("/admin/roster");
  revalidatePath("/"); // Live Ratings
  revalidatePath("/players"); // directory placeholder
}

const SIMILAR = "a Player with a similar name exists: ";

/**
 * The roster's "Add a Player" (ADR-165, #246 S1 E6): a Talent (the default,
 * optionally with up to 2 credits and a reason) or straight into the First
 * Team. The server refuses a similar existing name unless the admin confirms
 * it is a different person.
 */
export async function addPlayer(
  _prev: AddPlayerState,
  formData: FormData,
): Promise<AddPlayerState> {
  await requireAdmin();

  const displayName = String(formData.get("display_name") ?? "").trim();
  const archetype = String(formData.get("archetype") ?? "all_rounder");
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const stage = String(formData.get("stage") ?? "talent");
  const credits = stage === "talent" ? Number(formData.get("credits") ?? 0) : 0;
  const reason = String(formData.get("credit_reason") ?? "").trim();
  const allowSimilar = formData.get("allow_similar") === "on";

  if (!displayName || displayName.length > 80) {
    return { ok: false, error: "Display name must be 1–80 characters." };
  }
  if (!isArchetype(archetype)) {
    return { ok: false, error: "Pick a valid archetype." };
  }
  if (stage !== "talent" && stage !== "first_team") {
    return { ok: false, error: "Start them as a Talent or in the First Team." };
  }
  if (!Number.isInteger(credits) || credits < 0 || credits > 2) {
    return { ok: false, error: "A Talent starts with 0 to 2 credits." };
  }
  if (credits > 0 && (reason.length < 3 || reason.length > 200)) {
    return { ok: false, error: "Give a reason of 3–200 characters for the credits." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("admin_register_player", {
    p_display_name: displayName,
    p_archetype: archetype,
    p_full_name: fullName,
    p_stage: stage,
    p_credits: credits,
    p_credit_reason: credits > 0 ? reason : null,
    p_allow_similar: allowSimilar,
  });

  if (error) {
    if (error.message.includes(SIMILAR)) {
      const similar = error.message.slice(error.message.indexOf(SIMILAR) + SIMILAR.length);
      return { ok: false, error: `A Player with a similar name exists: ${similar}.`, similar };
    }
    return {
      ok: false,
      error: error.message.includes("admin access")
        ? "You don't have permission to do this."
        : "Couldn't add the player. Check the name and try again.",
    };
  }

  revalidateRoster();
  return {
    ok: true,
    player: data as { slug: string; display_name: string; stage: string; credits: number },
  };
}

/** Go-live (ADR-165): always the current football week, once, never undone. */
export async function recordAcademyGoLive(): Promise<RosterActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("admin_record_academy_go_live");
  if (error) {
    if (error.message.includes("admin access"))
      return { ok: false, error: "You don't have permission to do this." };
    if (error.message.includes("already live"))
      return { ok: false, error: "The Academy is already live." };
    return { ok: false, error: "Couldn't record go-live. Please try again." };
  }
  revalidateRoster();
  revalidatePath("/players");
  const week = (data as { go_live_week?: string } | null)?.go_live_week;
  return { ok: true, message: `The Academy is live from the week of ${week ?? "this week"}.` };
}

export async function manageRoster(
  _prev: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  await requireAdmin();

  const intent = String(formData.get("intent") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  if (!isUuid(playerId)) return { ok: false, error: "Invalid player." };

  const supabase = await createClient();

  if (intent === "toggle") {
    const makeActive = String(formData.get("is_active") ?? "") === "true";
    const { data, error } = await supabase.schema("kut").rpc("admin_set_player_active", {
      p_player_id: playerId,
      p_is_active: makeActive,
    });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("admin access")
          ? "You don't have permission to do this."
          : "Couldn't update the player. Please try again.",
      };
    }
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return {
      ok: true,
      message: `${row?.display_name ?? "Player"} ${makeActive ? "reactivated" : "deactivated"}.`,
    };
  }

  if (intent === "delete") {
    const { data, error } = await supabase
      .schema("kut")
      .rpc("admin_delete_player", { p_player_id: playerId });
    if (error) {
      if (error.message.includes("admin access"))
        return { ok: false, error: "You don't have permission to do this." };
      if (error.code === "P0001") {
        return {
          ok: false,
          error:
            "This player has history (attendance, an account, an invite, or owned cards). Deactivate them instead.",
        };
      }
      return { ok: false, error: "Couldn't delete the player. Please try again." };
    }
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Player"} deleted.` };
  }

  if (intent === "credit") {
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3 || reason.length > 200) {
      return { ok: false, error: "Give a reason of 3–200 characters." };
    }
    const { data, error } = await supabase.schema("kut").rpc("admin_grant_academy_credit", {
      p_player_id: playerId,
      p_reason: reason,
    });
    if (error) return { ok: false, error: academyError(error.message) };
    revalidateRoster();
    const row = data as { active_credits?: number; stage?: string } | null;
    return {
      ok: true,
      message:
        row?.stage === "first_team"
          ? "Credit given, and that promoted them to the First Team."
          : `Credit given (${row?.active_credits ?? 1} of 2 active).`,
    };
  }

  if (intent === "promote") {
    const { data, error } = await supabase
      .schema("kut")
      .rpc("admin_promote_player", { p_player_id: playerId });
    if (error) return { ok: false, error: academyError(error.message) };
    revalidateRoster();
    const row = data as { display_name?: string; promoted?: boolean } | null;
    return {
      ok: true,
      message: row?.promoted
        ? `${row.display_name ?? "The Player"} is in the First Team.`
        : `${row?.display_name ?? "The Player"} was already in the First Team.`,
    };
  }

  if (intent === "start_injury") {
    const startedOn = String(formData.get("started_on") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) {
      return { ok: false, error: "Pick the date of the injury." };
    }
    if (note.length > 200) return { ok: false, error: "Keep the note to 200 characters." };
    const { data, error } = await supabase.schema("kut").rpc("admin_start_injury", {
      p_player_id: playerId,
      p_started_on: startedOn,
      p_note: note || null,
    });
    if (error) return { ok: false, error: injuryError(error.message) };
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Player"} is now in injury mode.` };
  }

  if (intent === "end_injury") {
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3 || reason.length > 200) {
      return { ok: false, error: "Give a reason of 3–200 characters." };
    }
    const { data, error } = await supabase.schema("kut").rpc("admin_end_injury", {
      p_player_id: playerId,
      p_reason: reason,
    });
    if (error) return { ok: false, error: injuryError(error.message) };
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `Injury mode ended for ${row?.display_name ?? "the player"}.` };
  }

  return { ok: false, error: "Unknown action." };
}

// The Academy RPCs (ADR-165) raise short, stable messages too.
function academyError(message: string): string {
  if (message.includes("admin access")) return "You don't have permission to do this.";
  if (message.includes("reactivate the Player")) return "Reactivate the Player first.";
  if (message.includes("at most 2 active credits"))
    return "They already hold 2 active credits, the most a Player can have.";
  if (message.includes("credits are for")) return "Credits are for Talents and Retired Players.";
  if (message.includes("reason")) return "Give a reason of 3–200 characters.";
  return "Couldn't update the Player. Please try again.";
}

// kut.admin_start_injury / admin_end_injury raise short, stable messages
// (ADR-082); map the ones an admin can act on, and fall back for the rest.
function injuryError(message: string): string {
  if (message.includes("admin access")) return "You don't have permission to do this.";
  if (message.includes("own player"))
    return "Another admin has to put your own player in injury mode.";

  if (message.includes("played since"))
    return "The player has played a published session after that date. Pick a later date.";
  if (message.includes("already in injury mode")) return "This player is already in injury mode.";
  if (message.includes("not in injury mode")) return "This player isn't in injury mode.";
  if (message.includes("injury date")) return "The injury date can't be in the future.";
  return "Couldn't update injury mode. Please try again.";
}
