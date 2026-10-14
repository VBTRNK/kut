"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { respondToOffer, withdrawOffer, type OfferState } from "../actions";

const initialState: OfferState = { error: null };

function RespondButton({
  offerId,
  accept,
  label,
  primary,
}: {
  offerId: string;
  accept: boolean;
  label: string;
  primary: boolean;
}) {
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(respondToOffer, initialState);

  function action(data: FormData) {
    key.current ??= crypto.randomUUID();
    data.set("idempotencyKey", key.current);
    data.set("accept", String(accept));
    return formAction(data);
  }

  return (
    <form action={action} className="min-w-0 flex-1">
      <input name="offerId" type="hidden" value={offerId} />
      {state.error && (
        <p className="mb-2 rounded-lg bg-brick-bg p-2 text-small text-brick">{state.error}</p>
      )}
      <Button kind={primary ? "primary" : "secondary"} wide disabled={pending} type="submit">
        {pending ? "Working..." : label}
      </Button>
    </form>
  );
}

export function RespondToOfferForms({ offerId, primary }: { offerId: string; primary: boolean }) {
  return (
    <div className="mt-3 flex gap-2">
      <RespondButton accept={false} label="Decline" offerId={offerId} primary={false} />
      <RespondButton accept label="Accept" offerId={offerId} primary={primary} />
    </div>
  );
}

export function WithdrawOfferForm({ offerId }: { offerId: string }) {
  const [state, formAction, pending] = useActionState(withdrawOffer, initialState);
  return (
    <form action={formAction} className="mt-3">
      <input name="offerId" type="hidden" value={offerId} />
      {state.error && (
        <p className="mb-2 rounded-lg bg-brick-bg p-2 text-small text-brick">{state.error}</p>
      )}
      <Button kind="secondary" disabled={pending} type="submit">
        {pending ? "Withdrawing..." : "Withdraw"}
      </Button>
    </form>
  );
}
