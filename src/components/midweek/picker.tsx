"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import Link from "next/link";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, FilterSheet } from "@/components/ui/filter-sheet";
import { InfoLink } from "@/components/ui/links";
import { FOCUS } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { FilterButton } from "@/components/ui/toolbar";
import { saveMidweekSquad, type MidweekActionState } from "@/app/(app)/midweek/actions";
import {
  archetypeFilters,
  formatClock,
  formatSavedAt,
  formatWeekday,
  prefillNotice,
  saveStatus,
  type Segment,
} from "@/lib/midweek/entry";
import {
  keeperLine,
  LINE_NAMES,
  lineCount,
  lineCountLabel,
  lineCountShort,
  lineVerdict,
  NO_KEEPER_COUNT,
  plussesLine,
  type LineCount,
} from "@/lib/midweek/plusses";
import { MidweekMiniCard } from "./mini-card";

/** One pick tile: a Player, and the strongest copy a save sends for them. */
export type PickCard = {
  playerId: string;
  cardId: string;
  displayName: string;
  /** The archetype the card plays this week (ADR-099), and its name. */
  archetype: string;
  archetypeLabel: string;
  /** "Goalkeeper this week, Speedster from next" when it changed since the open (KB-028). */
  change: string | null;
  /** The coming archetype's name, for the card badge "Speedster from next week". */
  next: string | null;
  tierLabel: string;
  copies: number;
  card: LiveCardPlayer;
};

export type LastWeekPrefill = {
  slots: (string | null)[];
  lostNames: string[];
  lostSlots: number[];
};

type MidweekPickerProps = {
  cards: PickCard[];
  /** Player ids per slot, from the saved squad. */
  initialSlots: (string | null)[];
  savedCardIds: string[];
  savedAt: string | null;
  lastWeek: LastWeekPrefill | null;
  lockAt: string;
  trialistOvr: number;
  /** Saved cards the member no longer owns, already worded. */
  lostSavedNotice: string | null;
  /** The Picker-Starter lead, when fewer than five Players are owned. */
  starterLead: string | null;
};

/** A notice above the five: something changed under the member, or a starter's trialists. */
function Notice({ children, live = false }: { children: React.ReactNode; live?: boolean }) {
  return (
    <div
      className="grid gap-1 rounded-xl border border-warning-line bg-warning-bg/55 px-4 py-3 text-small text-ink"
      role={live ? "status" : undefined}
    >
      {children}
    </div>
  );
}

function Segments({ segments }: { segments: readonly Segment[] }) {
  return segments.map((segment, index) =>
    segment.strong ? (
      <b className="font-semibold" key={index}>
        {segment.text}
      </b>
    ) : (
      <span key={index}>{segment.text}</span>
    ),
  );
}

/** KB-028: a Player whose archetype changed since the week opened, in words. */
function ChangeNote({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-small font-semibold text-warning">
      <span aria-hidden="true">&#8635;</span>
      {text}
    </span>
  );
}

/** KB-028 on the card face: the `LiveCard` badge "Speedster from next week". */
function nextBadge(card: PickCard) {
  return card.next ? <Tag tone="warn">{card.next} from next week</Tag> : undefined;
}

/** The plusses per line (DR3 kept, DR5-10): three insets, the verdict, the rule behind a link. */
function Plusses({ count }: { count: LineCount }) {
  return (
    <section aria-label="Plusses per line" className="grid gap-2">
      {count.kind === "count" && (
        <div aria-label={lineCountLabel(count)} className="grid grid-cols-3 gap-2" role="group">
          {LINE_NAMES.map((name, line) => (
            <div
              aria-hidden="true"
              className="grid gap-0.5 rounded-xl bg-panel-2/80 px-3 py-2.5"
              key={name}
            >
              <span className="text-label font-semibold text-ink-faint">{name}</span>
              <span
                className={`text-body font-semibold tabular-nums ${count.short[line] > 0 ? "text-warning" : "text-moss"}`}
              >
                {count.lines[line]}
                {count.short[line] > 0 ? ` · ${count.short[line]} short` : " ✓"}
              </span>
            </div>
          ))}
        </div>
      )}
      {count.kind === "count" ? (
        <>
          <p aria-live="polite" className="text-small text-ink">
            <b className="font-semibold">{lineVerdict(count).lead}</b> {lineVerdict(count).rest}
          </p>
          <p className="text-small text-ink-dim">{keeperLine(count)}</p>
        </>
      ) : (
        <p aria-live="polite" className="text-small text-ink-dim">
          {NO_KEEPER_COUNT}
        </p>
      )}
      <InfoLink href="/how-it-works#plusses">How plusses work</InfoLink>
    </section>
  );
}

/**
 * The picker at `/midweek/pick` (DR5-13, ADR-154), from the top: your five as
 * slots with the plusses per line, the save bar with the one-line privacy
 * notice (DR5-8, ADR-091), then your cards with the archetypes in the Filter
 * sheet. One row per Player below `lg`, the card grid from `lg` with the five
 * and the save bar sticky on the left. Adding fills the first empty slot.
 */
export function MidweekPicker({
  cards,
  initialSlots,
  savedCardIds,
  savedAt,
  lastWeek,
  lockAt,
  trialistOvr,
  lostSavedNotice,
  starterLead,
}: MidweekPickerProps) {
  const byPlayer = useMemo(() => new Map(cards.map((card) => [card.playerId, card])), [cards]);
  const [slots, setSlots] = useState<(string | null)[]>(initialSlots);
  const [prefillText, setPrefillText] = useState<ReturnType<typeof prefillNotice> | null>(null);
  const [filter, setFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState<MidweekActionState, FormData>(
    saveMidweekSquad,
    null,
  );

  const picked = slots.map((playerId) => (playerId ? (byPlayer.get(playerId) ?? null) : null));
  const sendCardIds = picked.flatMap((card) => (card ? [card.cardId] : []));
  const status = saveStatus(savedCardIds, sendCardIds);
  const inSquad = new Set(slots.filter((id): id is string => id !== null));
  // The weakest-line rule on the five as picked (ADR-116, DR3 HANDOFF §4).
  const count = lineCount(
    picked.map((card) =>
      card ? { archetype: card.archetype, displayName: card.displayName } : null,
    ),
  );
  const countShort = lineCountShort(count);
  const firstEmpty = slots.indexOf(null);
  const full = firstEmpty === -1;
  const filters = archetypeFilters(cards);
  const shown = filter === "all" ? cards : cards.filter((card) => card.archetype === filter);
  const filterLabel = filters.find((chip) => chip.key === filter)?.label ?? "All";
  const line =
    state?.ok === false
      ? state.error
      : state?.ok && status === "saved"
        ? state.message
        : status === "none"
          ? "Not picked: an auto squad plays."
          : status === "dirty"
            ? "Save to make it count."
            : `${savedAt ? `Saved ${formatSavedAt(savedAt)}. ` : ""}Change them until ${formatWeekday(lockAt)} ${formatClock(lockAt)}.`;

  function add(playerId: string) {
    if (full) return;
    setSlots(slots.map((id, index) => (index === firstEmpty ? playerId : id)));
  }

  function remove(index: number) {
    setSlots(slots.map((id, i) => (i === index ? null : id)));
  }

  function loadLastWeek() {
    if (!lastWeek) return;
    setSlots(lastWeek.slots);
    setPrefillText(prefillNotice(lastWeek.lostNames, lastWeek.lostSlots));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const notice = prefillText ? (
    <Notice live>
      <p>
        <Segments segments={prefillText} />
      </p>
    </Notice>
  ) : lostSavedNotice ? (
    <Notice>
      <p>{lostSavedNotice}</p>
    </Notice>
  ) : starterLead ? (
    <Notice>
      <p>{starterLead}</p>
      <InfoLink href="/club/packs">Open a pack</InfoLink>
    </Notice>
  ) : null;

  const addLabel = (card: PickCard) =>
    `Add to your five: ${card.displayName}${card.card.injured ? ", injured" : ""}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
      {/* Below lg the five, the save bar and the cards are one column; with
          unsaved changes on a phone the save bar moves after the cards and
          sticks above the tab bar, so Save stays in reach while picking. */}
      <div className="contents lg:sticky lg:top-24 lg:grid lg:grid-cols-[minmax(0,1fr)] lg:gap-4">
        {notice}
        <Block
          aside={<p className="text-small text-ink-dim">Empty slots play a trialist</p>}
          id="five-h"
          title="Your five"
        >
          <ol aria-label="Your five" className="grid gap-1.5">
            {picked.map((card, index) => (
              <li
                className={`grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-1.5 ${
                  card ? "bg-panel-2/80" : "border border-dashed border-line"
                }`}
                key={index}
              >
                {card ? (
                  <MidweekMiniCard
                    injured={card.card.injured}
                    ovr={card.card.liveOvr}
                    rarityTier={card.card.rarityTier}
                    small
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid aspect-[5/7] w-[34px] place-items-center rounded-md border border-dashed border-line text-label text-ink-faint"
                  >
                    {index + 1}
                  </span>
                )}
                <span className="grid min-w-0">
                  <span
                    className={`text-body [overflow-wrap:anywhere] ${card ? "font-semibold" : "text-ink-dim"}`}
                  >
                    {card ? card.displayName : "Trialist"}
                  </span>
                  <span className="text-small text-ink-dim">
                    {card
                      ? `${card.archetypeLabel} · OVR ${card.card.liveOvr}${card.card.injured ? " · injured" : ""}`
                      : `OVR ${trialistOvr}`}
                  </span>
                  {card?.change && <ChangeNote text={card.change} />}
                </span>
                {card && (
                  <button
                    aria-label={`Remove ${card.displayName} from slot ${index + 1}`}
                    className={`inline-flex min-h-11 items-center rounded-md px-2 text-small font-semibold text-ink-dim hover:text-ink ${FOCUS}`}
                    onClick={() => remove(index)}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ol>
          {inSquad.size > 0 && <Plusses count={count} />}
        </Block>

        <form
          className={`grid gap-3 rounded-2xl border p-4 ${
            status === "dirty"
              ? "border-brass-line bg-panel max-sm:sticky max-sm:bottom-[calc(4.5rem_+_env(safe-area-inset-bottom,0px))] max-sm:z-20 max-sm:order-last max-sm:shadow-[0_-12px_24px_-10px_rgb(0_0_0/70%)]"
              : "border-line/60 bg-panel/60"
          }`}
          onSubmit={submit}
        >
          {sendCardIds.map((id) => (
            <input key={id} name="card_id" type="hidden" value={id} />
          ))}
          <p className="flex flex-wrap items-center gap-2 text-small">
            {status === "saved" ? (
              <Tag tone="won">✓ Saved</Tag>
            ) : status === "dirty" ? (
              <Tag tone="you">Not saved</Tag>
            ) : (
              <Tag>Not picked</Tag>
            )}
            <span
              className={state?.ok === false ? "font-semibold text-brick" : "text-ink-dim"}
              role="status"
            >
              {line}
            </span>
          </p>
          {/* On a phone with unsaved changes, the lines' verdict rides in the
              sticky bar, so the cost shows at the moment of saving (DR3). */}
          {status === "dirty" && inSquad.size > 0 && (
            <p
              className={`text-small font-semibold sm:hidden ${
                countShort.tone === "short"
                  ? "text-warning"
                  : countShort.tone === "ok"
                    ? "text-moss"
                    : "text-ink-faint"
              }`}
            >
              {countShort.text}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {status === "saved" ? (
              <Button
                kind="secondary"
                onClick={() =>
                  document.getElementById("cards-h")?.scrollIntoView({ block: "start" })
                }
              >
                Change your five
              </Button>
            ) : (
              <>
                <Button disabled={sendCardIds.length === 0 || pending} type="submit">
                  {pending ? "Saving…" : "Save your five"}
                </Button>
                {lastWeek && (
                  <span className={status === "dirty" ? "max-sm:hidden" : "contents"}>
                    <Button kind="secondary" onClick={loadLastWeek}>
                      Load last week&rsquo;s
                    </Button>
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-small text-ink-dim">
            Members see the five you enter from {formatClock(lockAt)}.{" "}
            <Link
              className={`font-semibold whitespace-nowrap text-brass hover:underline ${FOCUS}`}
              href="/how-it-works#privacy"
            >
              Privacy&nbsp;›
            </Link>
          </p>
        </form>
      </div>

      <section aria-labelledby="cards-h" className="grid scroll-mt-24 content-start gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-heading font-semibold" id="cards-h">
            Your cards
          </h2>
          <FilterButton
            aria-haspopup="dialog"
            on={filter === "all" ? 0 : 1}
            onClick={() => setSheetOpen(true)}
            ref={filterButton}
          />
        </div>
        <p className="text-small text-ink-dim">
          {filter === "all"
            ? `${cards.length} Players`
            : `${filterLabel} · ${shown.length} of ${cards.length}`}
          {full && " · your five is full: remove a card to add another"}
        </p>
        <FilterSheet
          onApply={() => setSheetOpen(false)}
          onClear={() => setFilter("all")}
          onClose={() => setSheetOpen(false)}
          open={sheetOpen}
          result={`Show ${shown.length} ${shown.length === 1 ? "Player" : "Players"}`}
          returnFocusRef={filterButton}
        >
          <ChoiceGroup
            legend="Archetype"
            name="archetype"
            onChange={setFilter}
            options={filters.map((chip) => ({
              value: chip.key,
              label: `${chip.label} ${chip.count}`,
            }))}
            value={filter}
          />
        </FilterSheet>
        {shown.length === 0 && (
          <p className="text-small text-ink-dim">None of your cards play that this week.</p>
        )}

        {/* Below lg one row per Player; from lg the card grid. Each width has
            exactly one list, the other is `hidden`. */}
        <ul className="grid gap-1.5 lg:hidden">
          {shown.map((card) => {
            const isIn = inSquad.has(card.playerId);
            const plusses = plussesLine(card.archetype);
            return (
              <li
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2 ${
                  isIn ? "bg-moss-bg/60" : "bg-panel/60"
                }`}
                key={card.playerId}
              >
                <MidweekMiniCard
                  injured={card.card.injured}
                  ovr={card.card.liveOvr}
                  rarityTier={card.card.rarityTier}
                />
                <span className="grid min-w-0">
                  <span className="text-body font-semibold [overflow-wrap:anywhere]">
                    {card.displayName}
                  </span>
                  <span className="text-small text-ink-dim">
                    {card.archetypeLabel} &middot; {card.tierLabel} &middot; OVR {card.card.liveOvr}
                    {card.card.injured && " · injured"}
                    {card.copies > 1 && <> &middot; &times;{card.copies}</>}
                  </span>
                  {plusses && (
                    <span className="text-small text-ink-faint">
                      <span aria-hidden="true">{plusses.text}</span>
                      <span className="sr-only">{plusses.label}</span>
                    </span>
                  )}
                  {card.change && <ChangeNote text={card.change} />}
                </span>
                {isIn ? (
                  <Tag tone="won">
                    ✓ In<span className="sr-only"> your five: {card.displayName}</span>
                  </Tag>
                ) : (
                  <button
                    aria-label={addLabel(card)}
                    className={`min-h-11 rounded-lg border border-line px-3 text-small font-semibold text-ink hover:border-brass-line disabled:opacity-50 ${FOCUS}`}
                    disabled={full}
                    onClick={() => add(card.playerId)}
                    type="button"
                  >
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <ul className="hidden grid-cols-4 gap-x-4 gap-y-5 lg:grid">
          {shown.map((card) => {
            const isIn = inSquad.has(card.playerId);
            return (
              <li className="grid content-start gap-2" key={card.playerId}>
                <div
                  className={`relative ${
                    isIn
                      ? "[&_.live-card]:outline-3 [&_.live-card]:outline-offset-3 [&_.live-card]:outline-moss"
                      : ""
                  }`}
                >
                  <LiveCard badge={nextBadge(card)} player={card.card} />
                  {card.copies > 1 && (
                    <span className="absolute -top-1.5 -right-1 z-10">
                      <Tag>&times;{card.copies}</Tag>
                    </span>
                  )}
                </div>
                {isIn ? (
                  <p className="flex min-h-11 items-center justify-center rounded-xl border border-moss-line bg-moss-bg text-small font-semibold text-moss">
                    ✓ In your five<span className="sr-only">: {card.displayName}</span>
                  </p>
                ) : (
                  <button
                    aria-label={addLabel(card)}
                    className={`min-h-11 rounded-xl border border-line text-small font-semibold text-ink hover:border-brass-line disabled:opacity-50 ${FOCUS}`}
                    disabled={full}
                    onClick={() => add(card.playerId)}
                    type="button"
                  >
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
