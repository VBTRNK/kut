"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackArt } from "@/components/pack-art";
import { Block, Stat } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { Field, Switch } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { packKind, packPromise, promiseText } from "@/lib/packs";
import {
  PACK_SLUGS,
  VALUE_ROWS,
  economyWarnings,
  healthStatus,
  suggestedPrices,
  validPrice,
  type PackEconomy,
  type PackSettings,
  type PackSlug,
} from "@/lib/pack-economy";
import { applyPackSettings } from "./actions";

const num = (value: number | null, digits = 2) =>
  value === null ? "—" : value.toLocaleString("en-GB", { maximumFractionDigits: digits });
const pct = (value: number | null) => (value === null ? "—" : `${num(value * 100, 1)}%`);
const time = (value: string) =>
  value
    ? new Date(value).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"
    : "editor unavailable; Refresh";
const settingsOf = (data: PackEconomy) =>
  Object.fromEntries(
    data.packs.map((pack) => [pack.slug, { price: pack.price, is_active: pack.is_active }]),
  ) as PackSettings;
const head = "py-2 text-left font-semibold";
const cell = "py-2 pl-2 text-right tabular-nums";

export function EconomyForm({ initial }: { initial: PackEconomy }) {
  const [economy, setEconomy] = useState(initial);
  const [draft, setDraft] = useState(settingsOf(initial));
  const [state, action, pending] = useActionState(applyPackSettings, null);
  const [handled, setHandled] = useState(state);
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  if (state !== handled) {
    setHandled(state);
    if (state?.result) {
      const next = state.economy ?? {
        ...economy,
        revision: { revision: state.result.revision, changed_at: "", changed_by_name: null },
        packs: economy.packs.map((pack) => ({ ...pack, ...state.result!.packs[pack.slug] })),
      };
      setEconomy(next);
      setDraft(settingsOf(next));
    }
  }
  const packs = PACK_SLUGS.flatMap((slug) => economy.packs.filter((pack) => pack.slug === slug));
  const prices = Object.fromEntries(
    packs.map((pack) => [pack.slug, draft[pack.slug].price]),
  ) as Record<PackSlug, number>;
  const valid = packs.length === 3 && packs.every((pack) => validPrice(prices[pack.slug]));
  const suggestions = suggestedPrices(packs, prices["tfh-pack"]);
  const warnings = economyWarnings(packs, prices);
  const regular = packs.find((pack) => pack.slug === "tfh-pack");
  const changes = packs
    .flatMap((pack) => [
      draft[pack.slug].price !== pack.price
        ? `${pack.title} ${pack.price} → ${Number.isFinite(prices[pack.slug]) ? prices[pack.slug] : "?"}`
        : null,
      draft[pack.slug].is_active !== pack.is_active
        ? `${pack.title} ${draft[pack.slug].is_active ? "on" : "off"}`
        : null,
    ])
    .filter(Boolean);
  const busy = pending || refreshing;
  const valueRows = VALUE_ROWS.filter(([key]) => packs.some((pack) => (pack[key] ?? 0) > 0));
  const perThousand = (value: number | null, slug: PackSlug) =>
    value === null || !validPrice(prices[slug]) ? null : (value * 1000) / prices[slug];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Economy"
          sub={`Measured ${time(economy.measured_at)}, from the live roster and pack rules.`}
        />
        <Button
          disabled={busy}
          kind="secondary"
          onClick={() => startRefresh(() => router.refresh())}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      <form action={action} className="grid gap-6">
        <input name="revision" type="hidden" value={economy.revision?.revision ?? 0} />
        <input
          name="silver_active"
          type="hidden"
          value={String(draft["tfh-silver-pack"]?.is_active ?? false)}
        />
        <input
          name="gold_active"
          type="hidden"
          value={String(draft["tfh-gold-pack"]?.is_active ?? false)}
        />
        <Block
          title="Packs"
          aside={
            <span className="text-small text-ink-faint">
              Revision {economy.revision?.revision ?? 0}
              {economy.revision &&
                ` · ${economy.revision.changed_by_name ?? "Unknown editor"}, ${time(economy.revision.changed_at)}`}
            </span>
          }
        >
          {state?.error && (
            <p role="alert" className="text-small text-warning">
              {state.error}
            </p>
          )}
          {state?.result && (
            <p
              role={state.result.status === "conflict" ? "alert" : "status"}
              className="text-small text-brass"
            >
              {state.result.status === "conflict"
                ? "Another admin applied changes while you were editing. The form now shows current values. Check them and apply again."
                : state.result.status === "applied"
                  ? "Pack settings applied."
                  : "Settings were already current."}
              {!state.economy &&
                " Settings are loaded; Refresh to update measurements and editor details."}
            </p>
          )}
          <fieldset disabled={busy} className="min-w-0">
            <legend className="sr-only">Pack prices and availability</legend>
            {packs.map((pack) => {
              const price = prices[pack.slug];
              const ratio =
                validPrice(price) && pack.expected_discard_per_pack !== null
                  ? pack.expected_discard_per_pack / price
                  : null;
              const health = ratio === null ? null : healthStatus(ratio);
              const suggested = suggestions[pack.slug];
              return (
                <div
                  key={pack.slug}
                  className="grid gap-4 border-b border-line/40 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_8rem_10rem_8rem] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="pack-thumb">
                      <PackArt kind={packKind(pack.slug)} cards={pack.cards_per_pack} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{pack.title}</p>
                      <p className="text-small text-ink-dim">
                        {pack.cards_per_pack} Live cards. {promiseText(packPromise(pack.min_tier))}{" "}
                        · {pack.qualifying_count} of {pack.eligible_count} qualify
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pack.slug === "tfh-pack" ? (
                      <Tag tone="won">Always on</Tag>
                    ) : (
                      <>
                        <Switch
                          label={`${pack.title} on sale`}
                          on={draft[pack.slug].is_active}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              [pack.slug]: {
                                ...draft[pack.slug],
                                is_active: !draft[pack.slug].is_active,
                              },
                            })
                          }
                        />
                        <Tag tone={draft[pack.slug].is_active ? "won" : "out"}>
                          {draft[pack.slug].is_active ? "On" : "Off"}
                        </Tag>
                      </>
                    )}
                  </div>
                  <Field
                    label={`${pack.title.replace(" pack", "")} price`}
                    name={pack.slug}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1_000_000}
                    step={1}
                    required
                    aria-invalid={!validPrice(price)}
                    value={Number.isNaN(price) ? "" : price}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [pack.slug]: { ...draft[pack.slug], price: event.target.valueAsNumber },
                      })
                    }
                    help={
                      suggested !== null && suggested !== undefined
                        ? `Suggested ${num(suggested, 0)}`
                        : pack.suggestion_state === "unsupported"
                          ? "No finite suggestion: Regular cannot produce an outcome."
                          : pack.expected_discard_per_pack === null
                            ? "No suggestion: no qualifying Live players."
                            : "Enter a valid Regular price for suggestions."
                    }
                  />
                  <div className="grid gap-1">
                    <span className="text-label font-semibold text-ink-faint">Discard return</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {pct(ratio)}
                      {health && (
                        <Tag
                          tone={health === "Target" ? "won" : health === "Watch" ? "you" : "warn"}
                        >
                          {health}
                        </Tag>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </fieldset>
          <ul aria-live="polite" className="grid gap-2">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2 text-small">
                <Tag tone="warn">Check</Tag>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy || !valid || changes.length === 0}>
              {pending ? "Applying…" : "Apply changes"}
            </Button>
            <Button
              kind="secondary"
              disabled={busy || !Object.values(suggestions).some((price) => price !== null)}
              onClick={() =>
                setDraft(
                  Object.fromEntries(
                    packs.map((pack) => [
                      pack.slug,
                      {
                        ...draft[pack.slug],
                        price: suggestions[pack.slug] ?? draft[pack.slug].price,
                      },
                    ]),
                  ) as PackSettings,
                )
              }
            >
              Use suggested prices
            </Button>
            <span className="text-small text-ink-dim" role="status">
              {!valid
                ? "Prices must be whole coins from 1 to 1,000,000; all three definitions are required."
                : changes.length
                  ? `Unsaved: ${changes.join(", ")}`
                  : ""}
            </span>
          </div>
          <p className="text-small text-ink-faint">
            Warnings are advice. Apply saves valid prices and availability together. Suggestions
            target at most 75% current discard return and a 10% premium efficiency margin, rounded
            up to 25 coins. Refresh replaces drafts.
          </p>
        </Block>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Block title="Value at these prices">
            <table className="w-full table-fixed text-small">
              <caption className="sr-only">Pack value at draft prices</caption>
              <thead>
                <tr>
                  <th className={head} scope="col">
                    Measure
                  </th>
                  {packs.map((p) => (
                    <th key={p.slug} className={cell} scope="col">
                      {p.title.replace(" pack", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th colSpan={4} className={head} scope="colgroup">
                    Per 1,000 coins
                  </th>
                </tr>
                {valueRows.map(([key, label]) => (
                  <tr key={key} className="border-b border-line/30">
                    <th className="py-2 text-left font-normal text-ink-dim" scope="row">
                      {label}
                    </th>
                    {packs.map((p) => {
                      const value = perThousand(
                        p.expected_discard_per_pack === null ? null : p[key],
                        p.slug,
                      );
                      const base =
                        regular && regular.expected_discard_per_pack !== null
                          ? perThousand(regular[key], regular.slug)
                          : null;
                      const beats =
                        p !== regular && value !== null && base !== null && value > base + 1e-9;
                      return (
                        <td className={`${cell} ${beats ? "text-warning" : ""}`} key={p.slug}>
                          {beats && <span aria-label="Beats Regular per coin">▲ </span>}
                          {num(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th colSpan={4} className={head} scope="colgroup">
                    Per pack
                  </th>
                </tr>
                {(
                  [
                    ["chance_silver_plus", "Any Silver+"],
                    ["chance_gold_plus", "Any Gold+"],
                    ["chance_holo_plus", "Any Holo+"],
                    ["chance_elite", "Any Elite"],
                  ] as const
                )
                  .filter(([key]) => packs.some((p) => (p[key] ?? 0) > 0))
                  .map(([key, label]) => (
                    <tr key={key}>
                      <th className="py-2 text-left font-normal text-ink-dim" scope="row">
                        {label}
                      </th>
                      {packs.map((p) => (
                        <td className={cell} key={p.slug}>
                          {pct(p[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                <tr>
                  <th className="py-2 text-left font-normal text-ink-dim" scope="row">
                    Expected discard coins
                  </th>
                  {packs.map((p) => (
                    <td className={cell} key={p.slug}>
                      {num(p.expected_discard_per_pack)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="py-2 text-left font-normal text-ink-dim" scope="row">
                    Coins removed if all discarded
                  </th>
                  {packs.map((p) => (
                    <td className={cell} key={p.slug}>
                      {num(
                        validPrice(prices[p.slug]) && p.expected_discard_per_pack !== null
                          ? prices[p.slug] - p.expected_discard_per_pack
                          : null,
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="text-small text-ink-dim">
              ▲ beats Regular per coin. Empty pools show —; all-zero outcomes are omitted. Expected
              current discard value is not market value or realized pack ROI.
            </p>
          </Block>
          <div className="grid min-w-0 gap-6">
            <Block title="Openings by price paid">
              <table className="w-full table-fixed text-small">
                <caption className="sr-only">Actual pack openings and spend by paid price</caption>
                <thead>
                  <tr>
                    <th className={head} scope="col">
                      Pack
                    </th>
                    <th className={cell} scope="col">
                      Paid
                    </th>
                    <th className={cell} scope="col">
                      7 days
                    </th>
                    <th className={cell} scope="col">
                      28 days
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {economy.usage.map((row) => (
                    <tr
                      className="border-b border-line/30"
                      key={`${row.slug}:${row.title}:${row.price_paid}`}
                    >
                      <th className="py-2 text-left font-normal text-ink-dim" scope="row">
                        {row.title}
                      </th>
                      <td className={cell}>{num(row.price_paid, 0)}</td>
                      {(["7d", "28d"] as const).map((period) => (
                        <td className={cell} key={period}>
                          <span className="block">{num(row[`openings_${period}`], 0)} packs</span>
                          <span className="text-ink-dim">
                            {num(row[`coins_${period}`], 0)} coins
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {economy.usage.length === 0 && (
                <p className="text-small text-ink-dim">No paid openings in the last 28 days.</p>
              )}
            </Block>
            <Block title="Coins and wallets">
              <dl className="grid grid-cols-2 gap-3">
                <Stat
                  label="Median wallet"
                  value={num(economy.cohort.median_balance, 0)}
                  note={`${economy.cohort.members} members`}
                />
                <Stat
                  label="Cohort"
                  value={economy.cohort.members}
                  note={economy.cohort.definition}
                />
              </dl>
              <ul className="grid gap-1 text-small">
                {packs.map((p) => (
                  <li key={p.slug}>
                    Can afford {p.title} at draft price:{" "}
                    {validPrice(prices[p.slug])
                      ? economy.cohort.balances.filter((balance) => balance >= prices[p.slug])
                          .length
                      : "—"}
                  </li>
                ))}
              </ul>
              <table className="w-full table-fixed text-small">
                <caption className="sr-only">Signed cohort coin flows</caption>
                <thead>
                  <tr>
                    <th className={head} scope="col">
                      Coins
                    </th>
                    <th className={cell} scope="col">
                      7 days
                    </th>
                    <th className={cell} scope="col">
                      28 days
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["rewards_and_grants", "Rewards and grants"],
                      ["discards", "Discards"],
                      ["packs", "Packs"],
                      ["market_tax", "Market tax"],
                      ["admin_adjustments", "Admin adjustments"],
                    ] as const
                  ).map(([key, label]) => (
                    <tr key={key}>
                      <th className="py-2 text-left font-normal text-ink-dim" scope="row">
                        {label}
                      </th>
                      <td className={cell}>{num(economy.flows[key]?.net_7d ?? 0, 0)}</td>
                      <td className={cell}>{num(economy.flows[key]?.net_28d ?? 0, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-small text-ink-dim">
                Same cohort for wallets, usage and flows: enabled non-superadmin profiles. No
                test-account marker exists. Positive flows add coins; negative flows remove them.
                Market transfers and trade escrow are excluded. Period discards are not realized
                returns from those periods&apos; packs.
              </p>
            </Block>
          </div>
        </div>
      </form>
    </>
  );
}
