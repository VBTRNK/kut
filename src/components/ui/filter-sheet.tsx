"use client";

import type { ReactNode, RefObject } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "./button";
import { FOCUS } from "./page";

/**
 * `FilterSheet`: the one place filters live, at every width (Q7). A Heading
 * with Clear, a `ChoiceGroup` per field, and one primary naming the result
 * (`Show 22 Players`). It is `BottomSheet` with `everyWidth`, so a phone gets
 * a sheet and a desktop a centred panel.
 */
export function FilterSheet({
  open,
  onClose,
  returnFocusRef,
  onClear,
  result,
  onApply,
  children,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClear: () => void;
  /** The primary's words, naming what it shows. */
  result: string;
  onApply: () => void;
  children: ReactNode;
}) {
  return (
    <BottomSheet
      everyWidth
      label="Filter"
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading font-semibold">Filter</h2>
        <button
          className={`min-h-11 rounded-md text-small font-semibold text-brass ${FOCUS}`}
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
      </div>
      {children}
      <Button onClick={onApply} wide>
        {result}
      </Button>
    </BottomSheet>
  );
}

/**
 * A field in the filter sheet: a Small 600 legend and one row of choice chips.
 * Native radios under the chips, so arrow keys and screen readers work as a
 * radio group without any script of ours.
 */
export function ChoiceGroup({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-2 text-small font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <label
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-small font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass ${
                on ? "border-brass-line bg-brass-bg text-brass" : "border-line text-ink-dim"
              }`}
              key={option.value}
            >
              <input
                checked={on}
                className="sr-only"
                name={name}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
