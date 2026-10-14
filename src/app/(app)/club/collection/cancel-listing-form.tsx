"use client";

import { useActionState } from "react";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cancelListing, type ListingState } from "./market-actions";

const initialState: ListingState = { error: null };
export function CancelListingForm({
  cardId,
  listingId,
  price,
  expiresAt,
}: {
  cardId: string;
  listingId: string;
  price: number;
  // ADR-072: listings no longer all run 24 hours, so the real expiry is shown
  // rather than a fixed figure in the copy.
  expiresAt: string | null;
}) {
  const [state, action, pending] = useActionState(cancelListing, initialState);
  return (
    <Block title="On the market">
      <form action={action} className="grid gap-3">
        <input name="cardId" type="hidden" value={cardId} />
        <input name="listingId" type="hidden" value={listingId} />
        <p className="text-body font-semibold">Listed for {price} FLUT Coins</p>
        <p className="mt-1 text-small text-ink-dim">
          This card is locked while the listing is active
          {expiresAt ? `, until ${formatDate(expiresAt)}` : ""}.
        </p>
        {state.error && (
          <p className="mt-3 rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
        )}
        <Button kind="secondary" disabled={pending} type="submit">
          {pending ? "Cancelling..." : "Cancel listing"}
        </Button>
      </form>
    </Block>
  );
}
