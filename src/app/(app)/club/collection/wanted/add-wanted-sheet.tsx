"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { setCardWant } from "../discovery-actions";

export function AddWantedSheet({
  editions,
}: {
  editions: { id: string; name: string; title: string; selected: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button kind="secondary" ref={trigger} onClick={() => setOpen(true)}>
        Add a wanted card
      </Button>
      <BottomSheet
        everyWidth
        label="Add a wanted card"
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={trigger}
      >
        <h2 className="text-heading font-semibold">Add a wanted card</h2>
        <div className="grid gap-2">
          {editions.map((edition) => (
            <form
              action={setCardWant}
              className="flex items-center justify-between gap-3 border-b border-line/40 py-2"
              key={edition.id}
            >
              <input name="editionId" type="hidden" value={edition.id} />
              <input name="wanted" type="hidden" value={edition.selected ? "false" : "true"} />
              <span className="grid min-w-0">
                <span className="text-body font-semibold">{edition.name}</span>
                <span className="text-small text-ink-dim">{edition.title}</span>
              </span>
              <Button kind="secondary" type="submit" aria-pressed={edition.selected}>
                {edition.selected ? "Remove" : "Want"}
              </Button>
            </form>
          ))}
        </div>
        <Button
          kind="secondary"
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          Done
        </Button>
      </BottomSheet>
    </>
  );
}
