"use client";

import { useActionState, useRef, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { openPack, type OpenPackState } from "./actions";

const initialState: OpenPackState = { error: null };

type OpenPackFormProps = {
  packSlug: string;
  title: string;
  price: number;
  cardsPerPack: number;
  balance: number;
  canAfford: boolean;
};

export function OpenPackForm({
  packSlug,
  title,
  price,
  cardsPerPack,
  balance,
  canAfford,
}: OpenPackFormProps) {
  const idempotencyKey = useRef<string | null>(null);
  const [state, formAction, isPending] = useActionState(openPack, initialState);
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const quotedPrice = state.priceChanged && state.currentPrice ? state.currentPrice : price;

  function action(formData: FormData) {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", idempotencyKey.current);
    return formAction(formData);
  }

  const affordable = canAfford && balance >= quotedPrice;

  return (
    <form
      action={action}
      className="relative overflow-hidden rounded-2xl border border-brass-line bg-[radial-gradient(120%_100%_at_12%_0%,#4a2f08_0%,#1c1509_46%,#100d08_100%)] p-4 sm:p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-36 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(224,172,74,0.2),transparent_70%)]"
      />
      <div className="relative">
        <input name="packSlug" type="hidden" value={packSlug} />
        <input name="expectedPrice" type="hidden" value={quotedPrice} />
        <h2 className="text-heading font-semibold">{title}</h2>
        <p className="mt-3 text-small text-ink-dim">
          {cardsPerPack} Live Cards. Duplicates can happen.
        </p>
        {state.error && !confirming && (
          <p className="mt-4 rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-small font-semibold text-brick">
            {state.error}
          </p>
        )}
        <div className="mt-4 grid gap-3">
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
              ? `Leaves you ${(balance - quotedPrice).toLocaleString()}.`
              : "Earn coins by attending published sessions."}
          </p>
        </div>
      </div>
      <BottomSheet
        everyWidth
        label={`Open a ${title}?`}
        open={confirming}
        onClose={() => setConfirming(false)}
        returnFocusRef={trigger}
      >
        <h2 className="text-heading font-semibold">Open a {title}?</h2>
        <p className="text-body text-ink-dim">
          {quotedPrice} coins for {cardsPerPack} Live Cards. You keep{" "}
          {(balance - quotedPrice).toLocaleString()}.
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
