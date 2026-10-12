import { Block } from "@/components/ui/block";
import { LinkRow } from "@/components/ui/links";
import { Tag } from "@/components/ui/tag";
import type { CallRecord } from "@/lib/midweek/calls";

/**
 * `MidweekCalls` (DR3 HANDOFF §2, DR5-14): once the week is complete, the
 * member's calls for good, read-only, each with `✓ Right` or `Wrong`. A wrong
 * call is never marked as a failure: its tag is neutral.
 */
export function MidweekCalls({
  records,
  line,
}: {
  records: readonly CallRecord[];
  /** The weekly line, `You called 2 of 3 right: +4 FLUT Coins.` */
  line: string;
}) {
  return (
    <Block id="calls-h" title="Your calls">
      <p className="text-small text-ink-dim">{line}</p>
      <ul className="grid gap-1.5">
        {records.map((record) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-xl bg-panel-2/80 px-3 py-2.5"
            key={record.label}
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="text-small text-ink-dim">{record.label}</span>
              <span className="text-body">
                You picked <b className="font-semibold">{record.picked}</b>.
                {record.winner && ` ${record.winner} won.`}
              </span>
            </span>
            {record.correct === true ? (
              <Tag tone="won">✓ Right</Tag>
            ) : record.correct === false ? (
              <Tag tone="out">Wrong</Tag>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </Block>
  );
}

/** `Your calls` on Your night once the week is complete: one row with the weekly line. */
export function MidweekWeeklyCalls({ line, href }: { line: string; href: string }) {
  return (
    <ul className="rounded-2xl border border-line/60 bg-panel/60 px-4">
      <LinkRow href={href} meta={line} title="Your calls" />
    </ul>
  );
}
