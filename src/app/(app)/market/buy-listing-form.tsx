"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { buyListing, type BuyState } from "./actions";

const initialState: BuyState = { error: null };
export function BuyListingForm({
  listingId,
  price,
  canAfford,
  detail = false,
}: {
  listingId: string;
  price: number;
  canAfford: boolean;
  detail?: boolean;
}) {
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(buyListing, initialState);
  function action(data: FormData) {
    key.current ??= crypto.randomUUID();
    data.set("idempotencyKey", key.current);
    return formAction(data);
  }
  const label = canAfford ? `Buy for ${price} FLUT Coins` : `Need ${price} FLUT Coins`;
  return (
    <form action={action}>
      <input name="listingId" type="hidden" value={listingId} />
      {state.error && (
        <p className="mb-2 rounded-xl bg-brick-bg p-2 text-small text-brick">{state.error}</p>
      )}
      <Button
        aria-label={label}
        kind={detail ? "primary" : "secondary"}
        wide
        disabled={pending || !canAfford}
        type="submit"
      >
        {pending
          ? "Buying..."
          : `${canAfford ? "Buy for" : "Need"} ${price.toLocaleString()}${detail ? " coins" : ""}`}
      </Button>
    </form>
  );
}
