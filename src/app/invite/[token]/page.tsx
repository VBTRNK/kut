import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { ClaimInviteForm } from "./claim-invite-form";

type InvitePageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <main className={PAGE}>
      <section className={`${COLUMN} max-w-md`}>
        <PageHeader
          title="Join FLUT"
          back={{ href: "/login", label: "Sign in" }}
          sub="You’re invited."
        />
        <ClaimInviteForm token={token} />
      </section>
    </main>
  );
}
