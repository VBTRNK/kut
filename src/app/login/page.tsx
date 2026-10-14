import { BrandLockup } from "@/components/brand-lockup";
import { COLUMN, PageHeader } from "@/components/ui/page";
import { BRAND } from "@/lib/brand";
import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ welcome?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;

  return (
    <main className="board-ground flex min-h-screen items-center justify-center px-4 py-8 text-ink sm:p-10">
      <section className={`${COLUMN} w-full max-w-md`}>
        <div className="space-y-4">
          <BrandLockup />
          <PageHeader title="Sign in" sub={`${BRAND.shortName} is for invited members.`} />
        </div>
        {query.welcome === "1" && (
          <p className="rounded-xl border border-moss-line/40 bg-moss-bg/50 p-4 text-body font-semibold text-moss">
            Your {BRAND.shortName} account is ready. Sign in to continue.
          </p>
        )}
        <LoginForm />
      </section>
    </main>
  );
}
