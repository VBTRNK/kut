"use client";

import { useActionState, useRef } from "react";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { discardCard, type DiscardState } from "./actions";

const initialState: DiscardState = { error: null };

type DiscardCardFormProps = {
  cardId: string;
  discardValue: number;
};

export function DiscardCardForm({ cardId, discardValue }: DiscardCardFormProps) {
  const idempotencyKey = useRef<string | null>(null);
  const [state, formAction, isPending] = useActionState(discardCard, initialState);

  function action(formData: FormData) {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", idempotencyKey.current);
    return formAction(formData);
  }

  function confirmDiscard(event: React.FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `Discard this card permanently for ${discardValue} FLUT Coins? This cannot be undone.`,
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <Block
      title="Discard"
      aside={<span className="text-small text-ink-dim">{discardValue} coins</span>}
    >
      <form action={action} className="grid gap-3" onSubmit={confirmDiscard}>
        <input name="cardId" type="hidden" value={cardId} />
        <p className="text-small text-ink-dim">This can’t be undone.</p>
        {state.error && (
          <p className="mt-3 rounded-xl bg-brick-bg p-3 text-small text-brick">{state.error}</p>
        )}
        <Button kind="secondary" disabled={isPending} type="submit">
          {isPending ? "Discarding..." : `Discard for ${discardValue}`}
        </Button>
      </form>
    </Block>
  );
}
