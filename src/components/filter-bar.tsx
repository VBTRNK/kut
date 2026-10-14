"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FilterSheet, ChoiceGroup } from "@/components/ui/filter-sheet";
import { Toolbar, SearchField, FilterButton } from "@/components/ui/toolbar";
import { Field } from "@/components/ui/form";
import { buildFilterHref, countActiveFilters, type FilterValues } from "@/lib/filters";

/** Search and an all-width Filter sheet, shared by Market, Players and Manage. */

export type FilterOption = { value: string; label: string };

export type FilterBarProps = {
  /** Route these filters live on, e.g. "/market". */
  basePath: string;
  /** Current values, straight from the page's searchParams. */
  values: FilterValues;
  searchPlaceholder: string;
  searchName?: string;
  sorts: FilterOption[];
  /** Omitted from the URL when selected, keeping the default clean. */
  defaultSort: string;
  sortName?: string;
  /** Rendered as chips. Short enumerated sets only — tiers, today. */
  chips?: { name: string; allLabel: string; options: FilterOption[] };
  /** Additional choice groups — archetypes, today. */
  selects?: { name: string; anyLabel: string; options: FilterOption[] }[];
  /** A numeric pair, e.g. min/max price. */
  range?: { minName: string; maxName: string; minLabel: string; maxLabel: string };
  /** Params that must survive every filter change, e.g. `view=manage`. */
  preserve?: FilterValues;
  /** Result line rendered under the bar, e.g. "12 of 48 shown". */
  summary?: string;
  result?: string;
};

export function FilterBar({
  basePath,
  values,
  searchPlaceholder,
  searchName = "q",
  sorts,
  defaultSort,
  sortName = "sort",
  chips,
  selects,
  range,
  preserve,
  summary,
  result = "Show cards",
}: FilterBarProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const href = (patch: FilterValues) =>
    buildFilterHref({ basePath, values, preserve, patch, defaults: { [sortName]: defaultSort } });

  const go = (patch: FilterValues) => router.push(href(patch));

  const activeCount = countActiveFilters(values, [sortName]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = new FormData(event.currentTarget).get(searchName);
    setSheetOpen(false);
    go({ [searchName]: typeof term === "string" ? term.trim() : "" });
  }

  return (
    <>
      <Toolbar
        summary={summary}
        filter={
          <FilterButton
            aria-expanded={sheetOpen}
            on={activeCount}
            ref={triggerRef}
            onClick={() => {
              setDraft(values);
              setSheetOpen(true);
            }}
          />
        }
      >
        <form action={basePath} onSubmit={submitSearch}>
          <SearchField
            label={searchPlaceholder}
            defaultValue={values[searchName] ?? ""}
            key={values[searchName] ?? ""}
            name={searchName}
          />
        </form>
      </Toolbar>
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        returnFocusRef={triggerRef}
        onClear={() => setDraft({})}
        result={result}
        onApply={() => {
          setSheetOpen(false);
          router.push(
            buildFilterHref({
              basePath,
              values: draft,
              preserve,
              patch: {},
              defaults: { [sortName]: defaultSort },
            }),
          );
        }}
      >
        {chips && (
          <ChoiceGroup
            legend="Tier"
            name={chips.name}
            value={draft[chips.name] ?? ""}
            options={[{ value: "", label: chips.allLabel }, ...chips.options]}
            onChange={(value) => setDraft({ ...draft, [chips.name]: value })}
          />
        )}
        {(selects ?? []).map((select) => (
          <ChoiceGroup
            key={select.name}
            legend={select.anyLabel}
            name={select.name}
            options={[{ value: "", label: select.anyLabel }, ...select.options]}
            value={draft[select.name] ?? ""}
            onChange={(value) => setDraft({ ...draft, [select.name]: value })}
          />
        ))}
        {range && (
          <fieldset className="grid gap-2">
            <legend className="pb-2 text-small font-semibold">Price</legend>
            <div className="grid grid-cols-2 gap-3">
              {[
                [range.minName, range.minLabel],
                [range.maxName, range.maxLabel],
              ].map(([name, label]) => (
                <Field
                  key={name}
                  label={label}
                  min={0}
                  step={1}
                  type="number"
                  value={draft[name] ?? ""}
                  onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
                />
              ))}
            </div>
          </fieldset>
        )}
        <ChoiceGroup
          legend="Sort"
          name={sortName}
          options={sorts}
          value={draft[sortName] ?? defaultSort}
          onChange={(value) => setDraft({ ...draft, [sortName]: value })}
        />
      </FilterSheet>
    </>
  );
}
