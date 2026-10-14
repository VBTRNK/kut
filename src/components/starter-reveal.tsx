"use client";

import { useState, useTransition } from "react";
import { markStarterOpened } from "@/app/welcome/actions";
import { PackReveal, type RevealCard } from "@/components/pack-reveal";

export function StarterReveal({ cards }: { cards: RevealCard[] }) {
  const [phase, setPhase] = useState<"sealed" | "revealing">("sealed");
  const [revealCards, setRevealCards] = useState<RevealCard[]>(cards);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await markStarterOpened();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevealCards(result.cards.length > 0 ? result.cards : cards);
      setPhase("revealing");
    });
  }

  if (phase === "revealing") {
    return (
      <PackReveal
        cards={revealCards}
        doneHref="/"
        doneLabel="Enter FLUT"
        title="Your starter pack"
      />
    );
  }

  return (
    <div className="pack-reveal space-y-5 text-center">
      <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-brass-line bg-[radial-gradient(circle_at_top,_#4a2f08,_#15130f_62%)]">
        <div className="pack-reveal__seal">
          <p aria-hidden="true" className="text-figure">
            &#127890;
          </p>
          <p className="mt-3 text-label font-semibold text-brass">Sealed starter pack</p>
        </div>
      </div>
      <p className="mx-auto max-w-md leading-7 text-ink-dim">
        250 FLUT Coins and three Live Cards are already yours.
      </p>
      {error && <p className="rounded-xl bg-brick-bg p-3 text-small text-brick">{error}</p>}
      <button
        className="min-h-12 rounded-xl bg-brass px-6 py-3 font-extrabold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
        disabled={pending}
        onClick={open}
        type="button"
      >
        {pending ? "Opening…" : "Open your starter pack"}
      </button>
    </div>
  );
}
