"use client";

import { Button } from "@/components/ui/button";
import { PageHeader, PAGE } from "@/components/ui/page";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep diagnostic detail in server/browser logs; users receive only a safe recovery message.
    console.error("KUT route error", { digest: error.digest });
  }, [error]);

  return (
    <main className={PAGE}>
      <section className="mx-auto max-w-lg rounded-2xl border border-brick-line/40 bg-panel p-4">
        <PageHeader title="This page could not be loaded" sub="FLUT needs a moment" />
        <p className="mt-3 text-body text-ink-dim">
          No game action was completed by this error. Try again, or return to Home and continue from
          there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button href="/" kind="secondary">
            Home
          </Button>
        </div>
      </section>
    </main>
  );
}
