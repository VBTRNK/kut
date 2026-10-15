import type { ReactNode } from "react";
import { AdminTabs } from "@/app/(app)/admin/admin-tabs";
import { Block, Stat } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { Field, Switch } from "@/components/ui/form";
import { COLUMN, PAGE, PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { Chrome } from "../ui-pass/build/pages";
import { Notice, PACKS, PackArt, ReviewLinks } from "./studies";

/**
 * `/admin/economy` for #223 S3, design only. Per-pack numbers are what the
 * canonical SQL will return (here: the research harness on the 15 Oct roster
 * fixture); the browser only divides them by draft prices, as the vision asks.
 */
export type PackMetrics = {
  key: "regular" | "silver" | "gold";
  title: string;
  promise: string;
  on: boolean;
  price: number;
  suggested: number | null;
  pool: number;
  eligible: number;
  perPack: { cards: number; discard: number; silver: number; gold: number; holo: number; elite: number };
  chance: { silver: number; gold: number; holo: number };
};

export const VALUE_ROWS = [
  ["cards", "Cards"], ["discard", "Discard coins"], ["silver", "Silver+ cards"],
  ["gold", "Gold+ cards"], ["holo", "Holo+ cards"], ["elite", "Elite cards"],
] as const;

const HEALTH = [
  ["target", "Target", "won"], ["watch", "Watch", "you"], ["warning", "Warning", "warn"], ["critical", "Critical", "warn"],
] as const;

export function healthOf(ratio: number) {
  return ratio >= 0.95 ? "critical" : ratio > 0.8 ? "warning" : ratio > 0.75 ? "watch" : "target";
}

const pct = (n: number) => `${(n * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
const num = (n: number, digits = 2) => n.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const coins = (n: number) => n.toLocaleString("en-GB");

function PackRow({ pack }: { pack: PackMetrics }) {
  const art = PACKS.find((p) => p.key === pack.key)!;
  const health = healthOf(pack.perPack.discard / pack.price);
  return (
    <div className="econ-row grid gap-4 border-b border-line/40 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_8.5rem_10rem_8.5rem] md:items-center" data-row={pack.key}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="pack-thumb"><PackArt pack={art} /></div>
        <div className="grid min-w-0">
          <p className="text-body font-semibold">{pack.title}</p>
          <p className="text-small text-ink-dim">
            {pack.pool === 0 ? "Unavailable: no qualifying players" : pack.key === "regular" ? `${pack.promise} · ${pack.eligible} Live players` : `${pack.promise} · ${pack.pool} of ${pack.eligible} qualify`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {pack.key === "regular" ? <Tag tone="won">Always on</Tag> : <>
          <Switch data-toggle={pack.key} label={`${pack.title} on sale`} on={pack.on} />
          <span data-state>{pack.on ? <Tag tone="won">On</Tag> : <Tag tone="out">Off</Tag>}</span>
        </>}
      </div>
      <Field data-price={pack.key} defaultValue={pack.price} help={pack.suggested === null ? "No suggestion" : `Suggested ${coins(pack.suggested)}`} inputMode="numeric" label={`${pack.title.replace(" pack", "")} price`} min={1} step={1} type="number" />
      <div className="grid gap-1">
        <span className="text-label font-semibold text-ink-faint">Discard return</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-body font-semibold tabular-nums" data-return>{pct(pack.perPack.discard / pack.price)}</span>
          <span data-health>{HEALTH.filter(([key]) => key === health).map(([key, label, tone]) => <Tag key={key} tone={tone}>{label}</Tag>)}</span>
        </span>
      </div>
    </div>
  );
}

function ValueTable({ packs }: { packs: PackMetrics[] }) {
  const rows = VALUE_ROWS.filter(([key]) => packs.some((p) => p.perPack[key] > 0));
  const cell = "py-2 pl-2 text-right font-semibold";
  const head = (label: string) => (
    <tr><th className="pt-4 pb-1 text-left text-label font-semibold text-ink-faint" colSpan={4} scope="colgroup">{label}</th></tr>
  );
  return (
    <table className="w-full text-small tabular-nums">
      <caption className="sr-only">Value of each pack at the prices in the form</caption>
      <thead>
        <tr className="border-b border-line/40">
          <th className="py-2 text-left font-semibold text-ink-dim" scope="col"><span className="sr-only">Measure</span></th>
          {packs.map((p) => <th className="py-2 pl-2 text-right font-semibold" key={p.key} scope="col">{p.title.replace(" pack", "")}</th>)}
        </tr>
      </thead>
      <tbody>
        {head("Per 1,000 coins")}
        {rows.map(([key, label]) => (
          <tr className="border-b border-line/30" key={key}>
            <th className="py-2 text-left font-normal text-ink-dim" scope="row">{label}</th>
            {packs.map((p) => <td className={cell} data-cell={`${p.key}:${key}`} key={p.key}>{num((p.perPack[key] * 1000) / p.price, key === "discard" ? 0 : 2)}</td>)}
          </tr>
        ))}
        {head("Per pack")}
        {(["silver", "gold", "holo"] as const).map((key) => (
          <tr className="border-b border-line/30" key={key}>
            <th className="py-2 text-left font-normal text-ink-dim" scope="row">Any {key === "silver" ? "Silver" : key === "gold" ? "Gold" : "Holo"}+</th>
            {packs.map((p) => <td className={cell} key={p.key}>{pct(p.chance[key])}</td>)}
          </tr>
        ))}
        <tr>
          <th className="py-2 text-left font-normal text-ink-dim" scope="row">Coins removed if all discarded</th>
          {packs.map((p) => <td className={cell} data-removed={p.key} key={p.key}>{coins(Math.round(p.price - p.perPack.discard))}</td>)}
        </tr>
      </tbody>
    </table>
  );
}

function UseTable() {
  // Example figures shaped like the S1 analytics: grouped by stored pack and price actually paid.
  const rows: [string, string, ReactNode, ReactNode][] = [
    ["Regular", "250", <Used coins={10250} key="a" packs={41} />, <Used coins={10250} key="b" packs={41} />],
    ["TFH Pack", "175", "—", <Used coins={35875} key="c" packs={205} />],
    ["Silver", "500", "None yet", "None yet"],
    ["Gold", "750", "Off", "Off"],
  ];
  return (
    <table className="w-full text-small tabular-nums">
      <caption className="sr-only">Pack openings by price paid</caption>
      <thead>
        <tr className="border-b border-line/40 text-left">
          <th className="py-2 font-semibold" scope="col">Pack</th>
          <th className="py-2 pl-2 text-right font-semibold" scope="col">Paid</th>
          <th className="py-2 pl-2 text-right font-semibold" scope="col">7 days</th>
          <th className="py-2 pl-2 text-right font-semibold" scope="col">28 days</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([pack, paid, week, month]) => (
          <tr className="border-b border-line/30 last:border-b-0" key={`${pack}-${paid}`}>
            <th className="py-2 text-left font-normal text-ink-dim" scope="row">{pack}</th>
            <td className="py-2 pl-2 text-right">{paid}</td>
            <td className="py-2 pl-2 text-right text-ink-dim">{week}</td>
            <td className="py-2 pl-2 text-right text-ink-dim">{month}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Used({ packs, coins: spent }: { packs: number; coins: number }) {
  return <span className="grid"><span className="font-semibold text-ink">{packs} packs</span><span>{coins(spent)} coins</span></span>;
}

function CoinsBlock() {
  const flows = [["In: rewards and grants", 8717, 32842], ["In: discards", 3671, 17639], ["Out: packs", 10250, 46125], ["Out: market tax", 140, 560]] as const;
  return (
    <Block title="Coins and wallets">
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Median wallet" note="23 members" value="162" />
        <Stat label="Can afford Silver" note="Regular 4 · Gold 1" value="2" />
      </dl>
      <table className="w-full text-small tabular-nums">
        <caption className="sr-only">Coins in and out</caption>
        <thead>
          <tr className="border-b border-line/40">
            <th className="py-2 text-left font-semibold" scope="col">Coins</th>
            <th className="py-2 pl-2 text-right font-semibold" scope="col">7 days</th>
            <th className="py-2 pl-2 text-right font-semibold" scope="col">28 days</th>
          </tr>
        </thead>
        <tbody>
          {flows.map(([label, week, month]) => (
            <tr className="border-b border-line/30 last:border-b-0" key={label}>
              <th className="py-2 text-left font-normal text-ink-dim" scope="row">{label}</th>
              <td className="py-2 pl-2 text-right">{coins(week)}</td>
              <td className="py-2 pl-2 text-right">{coins(month)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-small text-ink-dim">Trades and market sales move coins between members, so they aren&apos;t counted.</p>
    </Block>
  );
}

/** The real admin header (layout.tsx) around the page. */
function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <Chrome balance={1250}>
      <div className="border-b border-line/40 bg-board-deep/80">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-8">
          <p className="mb-3 text-label font-semibold text-brass">Admin</p>
          <AdminTabs />
        </div>
      </div>
      {children}
    </Chrome>
  );
}

export function AdminEconomy({ packs, conflict = false }: { packs: PackMetrics[]; conflict?: boolean }) {
  return (
    <AdminFrame>
      <main className={PAGE}>
        <section className={`${COLUMN} lg:max-w-6xl`}>
          <Notice>Design preview of S3. Pack numbers: the 15 Oct roster fixture through the research harness. Openings, wallets and coin flows are example figures. Nothing is saved.</Notice>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <PageHeader sub="Measured 15 Oct 2026, 09:53, from the live roster and pack rules." title="Economy" />
            <Button href="admin.html" kind="secondary">Refresh</Button>
          </div>
          <form className="grid gap-6" data-econ>
            <Block aside={<span className="text-small text-ink-faint" data-revision>{conflict ? "Revision 5 · Alex, 15 Oct 10:20" : "Revision 4 · Sanne, 15 Oct 10:12"}</span>} title="Packs">
              {conflict && (
                <p className="rounded-xl border border-warning-line bg-warning-bg p-3 text-small text-warning" role="alert">
                  Alex applied changes at 10:20 while you were editing. The form now shows their values. Check them and apply again.
                </p>
              )}
              <div>{packs.map((pack) => <PackRow key={pack.key} pack={pack} />)}</div>
              <ul aria-live="polite" className="grid gap-2" data-warnings />
              <div className="flex flex-wrap items-center gap-3">
                <Button data-apply disabled type="submit">Apply changes</Button>
                <Button data-suggest kind="secondary">Use suggested prices</Button>
                <span className="text-small text-ink-dim" data-dirty role="status" />
              </div>
              <p className="text-small text-ink-faint">Warnings are advice. Apply always saves valid prices; members see changes on their next visit.</p>
            </Block>
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <Block title="Value at these prices">
                <ValueTable packs={packs} />
                <p className="text-small text-ink-dim">Regular should give the most per coin. Amber marks a pack that beats it.</p>
              </Block>
              <div className="grid gap-6">
                <Block title="Openings by price paid"><UseTable /></Block>
                <CoinsBlock />
              </div>
            </div>
          </form>
          <ReviewLinks here={conflict ? "admin-conflict.html" : "admin.html"} />
          <div hidden id="econ-templates">
            {HEALTH.map(([key, label, tone]) => <span data-health-template={key} key={key}><Tag tone={tone}>{label}</Tag></span>)}
            <span data-state-template="on"><Tag tone="won">On</Tag></span>
            <span data-state-template="off"><Tag tone="out">Off</Tag></span>
            <span data-warning-template><Tag tone="warn">Check</Tag></span>
          </div>
        </section>
      </main>
    </AdminFrame>
  );
}
