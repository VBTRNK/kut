"use client";

import { useActionState, useRef, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { PackArt } from "@/components/pack-art";
import { Button } from "@/components/ui/button";
import { TIER_NAME, promiseText, type PackKind, type PackPromise } from "@/lib/packs";
import { openPack, type OpenPackState } from "./actions";

const initialState: OpenPackState = { error: null };

type OpenPackFormProps = {
  packSlug: string;
  kind: PackKind;
  title: string;
  price: number;
  cardsPerPack: number;
  /** From the server's `min_tier`; null when the schema doesn't say. */
  promise: PackPromise;
  balance: number;
};

/** The promise line with its tier icon. Nothing at all when the server didn't say. */
function OfferPromise({ promise }: { promise: PackPromise }) {
  const text = promiseText(promise);
  if (!promise || !text) return null;
  if (promise.kind === "none") return <p className="text-body text-ink-dim">{text}</p>;
  return (
    <p className="flex items-center gap-2 text-body font-semibold text-ink">
      <span
        aria-hidden="true"
        className={`promise-icon live-card__tier-icon live-card__tier-icon--${promise.tier}`}
      />
      {text}
    </p>
  );
}

/**
 * One offer (#223 S2, `design/pack-tiers/BRIEF.md` "Shop"): art, name, cards,
 * promise, one button and what it leaves you. Every affordable offer gets the
 * brass button (owner decision). Paying confirms in the BottomSheet first.
 */
export function OpenPackForm({
  packSlug,
  kind,
  title,
  price,
  cardsPerPack,
  promise,
  balance,
}: OpenPackFormProps) {
  const idempotencyKey = useRef<string | null>(null);
  const [state, formAction, isPending] = useActionState(openPack, initialState);
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const quotedPrice = state.priceChanged && state.currentPrice ? state.currentPrice : price;
  const floor = promise?.kind === "floor" ? `, at least 1 ${TIER_NAME[promise.tier]}+` : "";

  function action(formData: FormData) {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", idempotencyKey.current);
    return formAction(formData);
  }

  const affordable = balance >= quotedPrice;

  return (
    <form
      action={action}
      className="pack-offer grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-line/60 bg-panel/60 p-4 sm:grid-cols-[minmax(0,1fr)] sm:content-start"
      data-offer={kind}
    >
      <div className="pack-offer__art">
        <PackArt cards={cardsPerPack} kind={kind} />
      </div>
      <div className="grid min-w-0 gap-1">
        <h2 className="text-heading font-semibold">{title}</h2>
        <p className="text-body text-ink">{cardsPerPack} Live Cards</p>
        <OfferPromise promise={promise} />
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-1">
        <input name="packSlug" type="hidden" value={packSlug} />
        <input name="expectedPrice" type="hidden" value={quotedPrice} />
        {state.error && !confirming && (
          <p className="rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-small font-semibold text-brick">
            {state.error}
          </p>
        )}
        <Button
          ref={trigger}
          disabled={isPending || !affordable}
          onClick={() => setConfirming(true)}
          wide
        >
          {isPending
            ? "Opening…"
            : affordable
              ? `Open for ${quotedPrice} coins`
              : `Need ${quotedPrice - balance} more coins`}
        </Button>
        <p className="text-small text-ink-dim">
          {affordable
            ? `Leaves you ${(balance - quotedPrice).toLocaleString("en-GB")}.`
            : "Earn coins by attending published sessions."}
        </p>
      </div>
      <BottomSheet
        everyWidth
        label={`Open a ${title}?`}
        open={confirming}
        onClose={() => setConfirming(false)}
        returnFocusRef={trigger}
      >
        <div className="flex items-center gap-4">
          <div className="pack-thumb">
            <PackArt cards={cardsPerPack} kind={kind} />
          </div>
          <h2 className="text-heading font-semibold">Open a {title}?</h2>
        </div>
        <p className="text-body text-ink-dim">
          {quotedPrice} coins for {cardsPerPack} Live Cards
          {floor}. You keep {(balance - quotedPrice).toLocaleString("en-GB")}.
        </p>
        {state.error && (
          <p
            role="alert"
            className="rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-small text-brick"
          >
            {state.error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            kind="secondary"
            onClick={() => {
              setConfirming(false);
              trigger.current?.focus();
            }}
          >
            Not now
          </Button>
          <Button
            disabled={isPending || balance < quotedPrice}
            onClick={() => {
              if (state.priceChanged) idempotencyKey.current = null;
            }}
            type="submit"
          >
            {isPending ? "Opening…" : `Pay ${quotedPrice}`}
          </Button>
        </div>
      </BottomSheet>
    </form>
  );
}
