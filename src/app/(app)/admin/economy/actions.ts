"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { PACK_SLUGS, validPrice, type PackEconomy, type SettingsResult } from "@/lib/pack-economy";
import { createClient } from "@/lib/supabase/server";

export type EconomyActionState = {
  error?: string;
  result?: SettingsResult;
  economy?: PackEconomy;
} | null;

export async function applyPackSettings(
  _previous: EconomyActionState,
  form: FormData,
): Promise<EconomyActionState> {
  await requireAdmin();
  const prices = PACK_SLUGS.map((slug) => Number(form.get(slug)));
  const revisionText = form.get("revision");
  const revision = Number(revisionText);
  const silver = form.get("silver_active");
  const gold = form.get("gold_active");
  if (
    prices.some((price) => !validPrice(price)) ||
    typeof revisionText !== "string" ||
    !revisionText.trim() ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !["true", "false"].includes(String(silver)) ||
    !["true", "false"].includes(String(gold))
  ) {
    return {
      error:
        "Prices must be whole coins from 1 to 1,000,000. Refresh if the settings revision is missing.",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("admin_apply_pack_settings", {
    p_expected_revision: revision,
    p_regular_price: prices[0],
    p_silver_price: prices[1],
    p_gold_price: prices[2],
    p_silver_active: silver === "true",
    p_gold_active: gold === "true",
  });
  if (error)
    return {
      error:
        error.code === "PGRST202"
          ? "Pack controls are unavailable on this schema. Refresh after the database rollout."
          : "Couldn't apply pack settings. Refresh to check current settings before trying again.",
    };
  const result = data as SettingsResult;
  const refreshed = await supabase.schema("kut").rpc("admin_pack_economy");
  return { result, ...(refreshed.error ? {} : { economy: refreshed.data as PackEconomy }) };
}
