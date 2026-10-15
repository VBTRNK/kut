import { requireAdmin } from "@/lib/auth/admin";
import type { PackEconomy } from "@/lib/pack-economy";
import { createClient } from "@/lib/supabase/server";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { EconomyForm } from "./economy-form";

export default async function EconomyPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("admin_pack_economy");
  if (error && error.code !== "PGRST202") throw new Error("Could not load pack economy.");
  return (
    <main className={PAGE}>
      <section className={`${COLUMN} lg:max-w-6xl`}>
        {error || !data ? (
          <>
            <PageHeader title="Economy" />
            <p role="status">
              Pack controls are unavailable on this schema. Refresh after the database rollout.
            </p>
            <Button href="/admin/economy" kind="secondary">
              Refresh
            </Button>
          </>
        ) : (
          <EconomyForm key={(data as PackEconomy).measured_at} initial={data as PackEconomy} />
        )}
      </section>
    </main>
  );
}
