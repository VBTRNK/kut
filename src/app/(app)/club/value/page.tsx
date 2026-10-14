import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { Block } from "@/components/ui/block";
import { InfoLink } from "@/components/ui/links";
import Link from "next/link";
import { ECONOMY } from "@/game/economy";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Club Value" };
const nf = new Intl.NumberFormat("en-US");
type ClubValueRow = {
  wallet_balance: number;
  card_count: number;
  unique_player_count: number;
  owned_cards_value: number;
  personal_card_weight: number;
  personal_card_player_name: string | null;
  personal_card_player_slug: string | null;
  personal_card_ovr: number;
  personal_card_base_value: number;
  personal_card_bonus: number;
  club_value: number;
};
type EditionRow = {
  edition_id: string;
  edition_title: string;
  discard_value: number;
  copy_count: number;
  club_value_contribution: number;
};

export default async function ClubValuePage() {
  await requireUser();
  const supabase = await createClient();
  const [valueResponse, editionsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_club_value")
      .select(
        "wallet_balance,card_count,unique_player_count,owned_cards_value,personal_card_weight,personal_card_player_name,personal_card_player_slug,personal_card_ovr,personal_card_base_value,personal_card_bonus,club_value",
      )
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("my_club_value_editions")
      .select("edition_id,edition_title,discard_value,copy_count,club_value_contribution")
      .order("club_value_contribution", { ascending: false }),
  ]);
  if (valueResponse.error || editionsResponse.error)
    throw new Error("Could not load your Club Value breakdown.");
  const value = (valueResponse.data as ClubValueRow | null) ?? {
    wallet_balance: 0,
    card_count: 0,
    unique_player_count: 0,
    owned_cards_value: 0,
    personal_card_weight: 4,
    personal_card_player_name: null,
    personal_card_player_slug: null,
    personal_card_ovr: 0,
    personal_card_base_value: 0,
    personal_card_bonus: 0,
    club_value: 0,
  };
  const editions = (editionsResponse.data ?? []) as EditionRow[];
  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader title="Club Value" back={{ href: "/club/collection", label: "Collection" }} />
        <Block title="Your Club Value">
          <p className="text-figure font-extrabold tabular-nums">{nf.format(value.club_value)}</p>
          <dl className="mt-7 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-label font-semibold text-ink-faint">Wallet</dt>
              <dd className="mt-2 text-heading font-extrabold">
                {nf.format(value.wallet_balance)}
              </dd>
            </div>
            <div>
              <dt className="text-label font-semibold text-ink-faint">Collection</dt>
              <dd className="mt-2 text-heading font-extrabold">
                {nf.format(value.owned_cards_value)}
              </dd>
            </div>
            <div>
              <dt className="text-label font-semibold text-ink-faint">Personal card</dt>
              <dd className="mt-2 text-heading font-extrabold">
                {nf.format(value.personal_card_bonus)}
              </dd>
            </div>
          </dl>
          <p className="mt-7 text-small text-ink-dim">
            {nf.format(value.wallet_balance)} + {nf.format(value.owned_cards_value)} +{" "}
            {nf.format(value.personal_card_bonus)} = {nf.format(value.club_value)} &middot;{" "}
            {value.card_count} cards, {value.unique_player_count} different players
          </p>
        </Block>
        <Block title="How copies count">
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ECONOMY.duplicateEditionWeights.map(({ label, percent }) => (
              <div className="rounded-xl border border-line p-3 text-center" key={label}>
                <p className="text-label text-ink-dim">{label}</p>
                <p className="mt-2 text-heading font-extrabold text-brass">{percent}%</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-small text-ink-dim">
            Per edition. Discard payouts stay at their full value.
          </p>
        </Block>
        <Block title="Your collection’s share">
          {editions.length === 0 ? (
            <p className="mt-4 text-ink-dim">No cards yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-line/50 border-y border-line/60">
              {editions.map((edition) => (
                <li
                  className="flex min-h-16 items-center justify-between gap-4 py-3"
                  key={edition.edition_id}
                >
                  <div>
                    <Link
                      className="font-extrabold text-brass hover:underline"
                      href={`/club/value/${edition.edition_id}`}
                    >
                      {edition.edition_title} &rarr;
                    </Link>
                    <p className="mt-1 text-label text-ink-dim">
                      {edition.copy_count} {edition.copy_count === 1 ? "copy" : "copies"} &middot;{" "}
                      {edition.discard_value} base value
                    </p>
                  </div>
                  <strong className="tabular-nums">
                    {nf.format(edition.club_value_contribution)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Block>
        <Block
          title={`Personal card ×${value.personal_card_weight ?? ECONOMY.personalCardClubWeight}`}
        >
          <p className="mt-2">
            {value.personal_card_player_name ? (
              <>
                <Link
                  className="text-brass underline"
                  href={`/players/${value.personal_card_player_slug}`}
                >
                  {value.personal_card_player_name}
                </Link>{" "}
                at OVR {value.personal_card_ovr}: {value.personal_card_base_value} &times;{" "}
                {value.personal_card_weight} = {value.personal_card_bonus}.
              </>
            ) : (
              "No player is linked to this account, so the personal-card bonus is zero."
            )}
          </p>
        </Block>
        <InfoLink href="/how-it-works#value">How Club Value works</InfoLink>
      </section>
    </main>
  );
}
