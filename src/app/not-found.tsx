import { Button } from "@/components/ui/button";
import { PageHeader, PAGE } from "@/components/ui/page";

export default function NotFound() {
  return (
    <main className={PAGE}>
      <section className="mx-auto max-w-lg rounded-2xl border border-line bg-panel p-4">
        <PageHeader title="Page not found" />
        <p className="mt-3 text-body text-ink-dim">
          This link is unavailable, or the card or saved result no longer belongs to this account.
        </p>
        <div className="mt-6">
          <Button href="/">Go to Home</Button>
        </div>
      </section>
    </main>
  );
}
