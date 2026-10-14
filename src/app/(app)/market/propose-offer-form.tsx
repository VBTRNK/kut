"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { ECONOMY } from "@/game/economy";
import { proposeOffer, type OfferState } from "./actions";

export type OfferableCard = {
  card_id: string;
  display_name: string;
  ovr: number;
  rarity_tier: string;
};

const initialState: OfferState = { error: null };

/**
 * The coin-and-card offer builder.
 *
 * This used to expand inline inside a market grid tile, behind a "Make an offer"
 * button. Since the grid went to two columns on a phone (KB-006 / ADR-051) a tile
 * is ~160px wide — far too narrow for a coin input and a scrollable card list — so
 * offers moved to the listing detail page, where this is the whole point of the
 * screen. It therefore renders open: there is no collapsed state left to manage.
 */
export function ProposeOfferForm({
  listingId,
  askingPrice,
  offerableCards,
}: {
  listingId: string;
  askingPrice: number;
  offerableCards: OfferableCard[];
}) {
  const [coinsInput, setCoinsInput] = useState<string>(String(askingPrice));
  const coins = Math.max(0, Math.floor(Number(coinsInput) || 0));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(proposeOffer, initialState);

  function action(data: FormData) {
    key.current ??= crypto.randomUUID();
    data.set("idempotencyKey", key.current);
    return formAction(data);
  }

  function toggle(cardId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else if (next.size < ECONOMY.tradeOfferMaxCards) next.add(cardId);
      return next;
    });
  }

  const nothingOffered = coins <= 0 && picked.size === 0;

  return (
    <form action={action} className="grid gap-3 text-left">
      <input name="listingId" type="hidden" value={listingId} />
      {[...picked].map((cardId) => (
        <input key={cardId} name="cardId" type="hidden" value={cardId} />
      ))}

      <Field
        label="Coins"
        id={`offer-coins-${listingId}`}
        min={0}
        name="offeredCoins"
        onChange={(event) => setCoinsInput(event.target.value)}
        onFocus={(event) => event.target.select()}
        step={1}
        type="number"
        value={coinsInput}
      />

      {offerableCards.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-small font-semibold">
            Add cards ({picked.size}/{ECONOMY.tradeOfferMaxCards})
          </legend>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {offerableCards.map((card) => {
              const checked = picked.has(card.card_id);
              return (
                <label
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-small ${
                    checked ? "border-brass bg-brass/10" : "border-line"
                  }`}
                  key={card.card_id}
                >
                  <input
                    checked={checked}
                    className="accent-brass"
                    disabled={!checked && picked.size >= ECONOMY.tradeOfferMaxCards}
                    onChange={() => toggle(card.card_id)}
                    type="checkbox"
                  />
                  <span className="font-semibold">{card.display_name}</span>
                  <span className="ml-auto text-label text-ink-dim capitalize">
                    {card.ovr} · {card.rarity_tier}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {state.error && (
        <p className="rounded-lg bg-brick-bg p-2 text-small text-brick">{state.error}</p>
      )}

      <Button kind="secondary" wide disabled={pending || nothingOffered} type="submit">
        {pending ? "Sending..." : "Send offer"}
      </Button>
      <p className="text-small text-ink-dim">
        Coins and cards are held until the seller answers, or for {ECONOMY.tradeOfferExpiryHours} h.
      </p>
    </form>
  );
}
