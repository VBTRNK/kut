import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

type CopyRow = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  display_name: string;
  discard_value: number;
  copy_position: number;
  weight_percent: number;
  club_value_contribution: number;
};
export default async function EditionCopiesPage({
  params,
}: {
  params: Promise<{ editionId: string }>;
}) {
  await requireUser();
  const { editionId } = await params;
  if (!isUuid(editionId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("my_club_value_copies")
    .select(
      "card_id,edition_id,edition_title,display_name,discard_value,copy_position,weight_percent,club_value_contribution",
    )
    .eq("edition_id", editionId)
    .order("copy_position");
  if (error) throw new Error("Could not load this copy breakdown.");
  const copies = (data ?? []) as CopyRow[];
  if (!copies.length) notFound();
  const first = copies[0];
  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader
          title="Your copies"
          back={{ href: "/club/value", label: "Club Value" }}
          sub={`${first.edition_title} · ${copies.length} copies. Each can be discarded for ${first.discard_value} FLUT Coins.`}
        />
        <div className="min-w-0 rounded-2xl border border-line/60 bg-panel/60 p-4">
          <table className="w-full text-left text-small">
            <thead className="border-b border-line text-label text-ink-faint">
              <tr>
                <th className="py-3">Copy</th>
                <th>Weight</th>
                <th className="text-right">Adds to Club Value</th>
              </tr>
            </thead>
            <tbody>
              {copies.map((copy) => (
                <tr className="border-b border-line/50" key={copy.card_id}>
                  <td className="py-4">
                    <Link
                      prefetch={false}
                      className="inline-flex min-h-11 items-center font-semibold hover:text-brass"
                      href={`/club/collection/${copy.card_id}`}
                    >
                      Copy {copy.copy_position}
                    </Link>
                  </td>
                  <td>{copy.weight_percent}%</td>
                  <td className="text-right font-extrabold tabular-nums">
                    {copy.club_value_contribution}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-small text-ink-dim">
          Positions are recalculated after every sale, transfer, or discard. No physical copy is
          permanently privileged.
        </p>
      </section>
    </main>
  );
}
