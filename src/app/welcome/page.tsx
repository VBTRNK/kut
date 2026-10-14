import { BrandLockup } from "@/components/brand-lockup";
import { PAGE, COLUMN } from "@/components/ui/page";
import { redirect } from "next/navigation";
import { StarterReveal } from "@/components/starter-reveal";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { loadStarterCards } from "./starter-cards";

export const metadata = { title: `Welcome to ${BRAND.shortName}` };

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("is_disabled, starter_opened_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.is_disabled) {
    redirect("/login");
  }
  if (profile.starter_opened_at) {
    redirect("/");
  }

  const cards = await loadStarterCards(supabase);

  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <header className="text-center">
          <BrandLockup centred />
          <h1 className="mt-6 font-serif text-title font-normal sm:text-title-lg">
            Your starter pack is waiting
          </h1>
        </header>
        <StarterReveal cards={cards} />
      </section>
    </main>
  );
}
