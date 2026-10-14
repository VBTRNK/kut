"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChoiceGroup, FilterSheet } from "@/components/ui/filter-sheet";
import { FilterButton } from "@/components/ui/toolbar";

export function AlbumFilter({
  selected,
  options,
  summary,
}: {
  selected: string;
  options: { value: string; label: string; count: number }[];
  summary: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-ink-dim">{summary}</p>
        <FilterButton
          ref={trigger}
          on={selected === "all" ? 0 : 1}
          aria-expanded={open}
          onClick={() => {
            setDraft(selected);
            setOpen(true);
          }}
        />
      </div>
      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={trigger}
        onClear={() => setDraft("all")}
        result={`Show ${options.find((option) => option.value === draft)!.count} Players`}
        onApply={() => {
          setOpen(false);
          router.push(
            draft === "all"
              ? "/club/collection"
              : `/club/collection?lens=${encodeURIComponent(draft)}&page=1`,
          );
        }}
      >
        <ChoiceGroup
          legend="Show"
          name="show"
          options={options.filter((option) => !option.value.includes(":"))}
          value={draft.includes(":") ? "all" : draft}
          onChange={setDraft}
        />
        <ChoiceGroup
          legend="Type"
          name="type"
          options={[
            { value: "all", label: "All types" },
            ...options.filter((option) => option.value.startsWith("type:")),
          ]}
          value={draft.startsWith("type:") ? draft : "all"}
          onChange={setDraft}
        />
        <ChoiceGroup
          legend="Tier"
          name="tier"
          options={[
            { value: "all", label: "All tiers" },
            ...options.filter((option) => option.value.startsWith("tier:")),
          ]}
          value={draft.startsWith("tier:") ? draft : "all"}
          onChange={setDraft}
        />
      </FilterSheet>
    </>
  );
}
