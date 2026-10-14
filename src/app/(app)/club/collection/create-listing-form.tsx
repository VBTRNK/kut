"use client";

import { useActionState, useState } from "react";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { ECONOMY } from "@/game/economy";
import { createListing, type ListingState } from "./market-actions";

const initialState: ListingState = { error: null };

// ADR-072: the seller picks how long the listing runs. The options mirror the
// allow-list enforced by kut.create_listing; the server action re-validates, so
// this control is convenience, not security.
const DURATIONS = ECONOMY.listingDurationChoiceHours;

export function CreateListingForm({
  cardId,
  minimumPrice,
  maximumPrice,
}: {
  cardId: string;
  minimumPrice: number;
  maximumPrice: number;
}) {
  const [state, action, pending] = useActionState(createListing, initialState);
  const [durationHours, setDurationHours] = useState<number>(ECONOMY.listingDurationHours);
  return (
    <Block title="List on the market">
      <form action={action} className="grid gap-3">
        <input name="cardId" type="hidden" value={cardId} />
        <Field
          label="Price"
          id="listing-price"
          defaultValue={minimumPrice}
          max={maximumPrice}
          min={minimumPrice}
          name="price"
          required
          step="1"
          type="number"
          help={`${minimumPrice} to ${maximumPrice} coins. The card is locked while listed.`}
        />
        <p className="text-small text-ink-dim">
          A {ECONOMY.marketTaxPercent}% tax is taken when it sells.
        </p>
        <fieldset className="mt-4">
          <legend className="text-small font-semibold">How long?</legend>
          <div className="mt-1 flex gap-2">
            {DURATIONS.map((hours) => (
              <label
                className={`min-h-11 flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center font-semibold outline-offset-2 outline-brass has-[:focus-visible]:outline-2 ${
                  durationHours === hours
                    ? "border-brass-line bg-brass text-ink-on-accent"
                    : "border-line bg-board-deep/60"
                }`}
                key={hours}
              >
                <input
                  checked={durationHours === hours}
                  className="sr-only"
                  name="durationHours"
                  onChange={() => setDurationHours(hours)}
                  type="radio"
                  value={hours}
                />
                {hours} hours
              </label>
            ))}
          </div>
        </fieldset>
        {state.error && (
          <p className="mt-3 rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
        )}
        <Button kind="secondary" disabled={pending} type="submit">
          {pending ? "Listing..." : `Create ${durationHours}-hour listing`}
        </Button>
      </form>
    </Block>
  );
}
