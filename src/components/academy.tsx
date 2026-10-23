import type { ReactNode } from "react";
import { MidweekNotice } from "@/components/midweek/bits";
import { MIDWEEK } from "@/game/midweek/config";
import { Block, Inset, Stat } from "@/components/ui/block";
import { InfoLink, LinkRow } from "@/components/ui/links";
import { Figure, Tag } from "@/components/ui/tag";
import {
  ACADEMY,
  academyLine,
  progressWords,
  weekLabel,
  weekStrip,
  weeksToRetire,
  type LifecycleRow,
  type StripWeek,
} from "@/lib/academy";

/**
 * The Academy's pieces (ADR-165, #246 S1 `design/academy/build/academy.tsx`):
 * progress pips, the Academy block on Players, the week strip and the stage
 * blocks on profiles and owned cards. The words beside each carry the
 * meaning; the pips and the strip are decoration.
 */

/**
 * `Progress`: three pips towards promotion. A filled pip is a counted week
 * played, a brass ring a credit, a dashed one is still to come.
 */
export function Progress({
  real,
  credits,
  size = "row",
}: {
  real: number;
  credits: number;
  size?: "row" | "big";
}) {
  const pip = size === "big" ? "h-6 w-6 text-small" : "h-3.5 w-3.5";
  const pips = Array.from({ length: ACADEMY.promoteAt }, (_, index) =>
    index < real ? "real" : index < real + credits ? "credit" : "empty",
  );
  return (
    <span aria-hidden="true" className="flex flex-none items-center gap-1">
      {pips.map((kind, index) => (
        <span
          className={`grid ${pip} place-items-center rounded-full font-extrabold leading-none ${
            kind === "real"
              ? "bg-brass"
              : kind === "credit"
                ? "border-2 border-brass text-brass"
                : "border-2 border-dashed border-line"
          }`}
          key={index}
        >
          {kind === "credit" && size === "big" ? "+" : null}
        </span>
      ))}
    </span>
  );
}

const HOW_ACADEMY = "/how-it-works#academy";
const HOW_RETIRED = "/how-it-works#retired";

/** The Academy on Players: visible Talents and comebacks (progress ≥ 2). */
export function AcademyBlock({ rows }: { rows: readonly LifecycleRow[] }) {
  return (
    <Block
      aside={<p className="text-small text-ink-dim">{rows.length} close to the First Team</p>}
      id="academy"
      title="Academy"
    >
      <p className="text-small text-ink-dim">
        Players without a card yet. Three weeks out of the last eight earns one.
      </p>
      {rows.length === 0 ? (
        <p className="text-small text-ink-dim">
          Nobody is close yet. A newcomer shows here after 2 counted weeks.
        </p>
      ) : (
        <ul className="grid">
          {rows.map((row) => (
            <LinkRow
              end={<Progress credits={row.progress_credits} real={row.progress_weeks} />}
              href={`/players/${row.slug}`}
              key={row.player_id}
              meta={academyLine(row)}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {row.display_name}
                  {row.lifecycle_stage === "retired" ? (
                    <Tag>Comeback</Tag>
                  ) : row.fading ? (
                    <Tag tone="warn">Fading</Tag>
                  ) : null}
                </span>
              }
            />
          ))}
        </ul>
      )}
      <InfoLink href={HOW_ACADEMY}>How the Academy works</InfoLink>
    </Block>
  );
}

/** The last eight counted weeks as a strip: played, credit, or not. */
export function WeekStrip({ weeks }: { weeks: readonly StripWeek[] }) {
  if (weeks.length === 0) return null;
  return (
    <ol aria-label="The last eight counted weeks" className="grid grid-cols-8 gap-1">
      {weeks.map((week, index) => (
        <li className="grid min-w-0 justify-items-center gap-1" key={index}>
          <span
            className={`grid h-8 w-full place-items-center rounded-md text-label font-semibold ${
              week.kind === "played"
                ? "bg-brass text-ink-on-accent"
                : week.kind === "credit"
                  ? "border-2 border-brass text-brass"
                  : week.kind === "before"
                    ? "bg-panel-2/40 text-ink-faint"
                    : "border border-dashed border-line text-ink-faint"
            }`}
          >
            <span aria-hidden="true">
              {week.kind === "played" ? "✓" : week.kind === "credit" ? "+" : ""}
            </span>
            <span className="sr-only">
              {week.day} {week.month}:{" "}
              {week.kind === "played" ? "played" : week.kind === "credit" ? "credit" : "no game"}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="grid justify-items-center text-label text-ink-faint tabular-nums"
          >
            <span>{week.day}</span>
            <span>{week.month}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A Talent's profile: the road to the First Team, their rating now. */
export function TalentRoad({ row, tierLabel }: { row: LifecycleRow; tierLabel: string }) {
  const first = row.display_name.split(" ")[0];
  const left = Math.max(0, ACADEMY.promoteAt - row.progress);
  const oldest = row.played_weeks?.[0];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start sm:gap-8">
      <Block aside={<Tag tone="auto">Talent</Tag>} title="Road to the First Team">
        <div className="flex flex-wrap items-center gap-4">
          <Progress credits={row.progress_credits} real={row.progress_weeks} size="big" />
          <Figure>
            {Math.min(row.progress, ACADEMY.promoteAt)} of {ACADEMY.promoteAt}
          </Figure>
        </div>
        <p className="text-body font-semibold">
          {left <= 1
            ? `One more counted week promotes ${first}.`
            : `${left} more counted weeks promote ${first}.`}
        </p>
        <p className="text-body text-ink-dim">
          {progressWords(row.progress_weeks, row.progress_credits)} out of the last eight. Promotion
          gives them a Live card in packs and a slot in the album.
        </p>
        {row.fading && (
          <MidweekNotice tone="warn">
            <span>
              {oldest && <b>{weekLabel(oldest)} drops off next week. </b>}
              Without a game then, they fall below 2 and leave the Academy until they play again.
            </span>
          </MidweekNotice>
        )}
        <WeekStrip weeks={weekStrip(row)} />
        <InfoLink href={HOW_ACADEMY}>How the Academy works</InfoLink>
      </Block>
      <div className="grid min-w-0 gap-6">
        <Block title="Rating">
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="OVR now" note={tierLabel} value={row.live_ovr} />
            <Stat label="In packs" note="After promotion" value="No" />
          </dl>
          <p className="text-small text-ink-dim">
            Their rating builds from their first game, so a promoted Talent&rsquo;s card starts
            where this one is.
          </p>
        </Block>
        <Block title="Midweek">
          <p className="text-body text-ink-dim">
            Talents in the Academy fill Midweek&rsquo;s trialist slots by name. They play at OVR{" "}
            {MIDWEEK.trialist.ovr}, like any trialist.
          </p>
        </Block>
      </div>
    </div>
  );
}

/** At risk: a First Team Player 8 counted weeks without a game. */
export function AtRiskBlock({ row, copies }: { row: LifecycleRow; copies?: number }) {
  const absent = row.absent_weeks ?? ACADEMY.atRiskWeeks;
  return (
    <Block aside={<Tag tone="warn">At risk</Tag>} title={`${absent} weeks without a game`}>
      <p className="text-body text-ink-dim">
        {row.display_name} retires after {ACADEMY.retireWeeks} counted weeks without a game:{" "}
        {weeksToRetire(row)} more. One game resets the count.
      </p>
      {copies ? (
        <p className="text-body text-ink-dim">
          Your {copies === 1 ? "copy stays" : `${copies} copies stay`} yours either way. Retired
          cards can&rsquo;t play Midweek.
        </p>
      ) : null}
      <InfoLink href={HOW_RETIRED}>When a Player retires</InfoLink>
    </Block>
  );
}

/** Retired: since when, and a comeback in progress if there is one. */
export function RetiredBlock({ row, children }: { row: LifecycleRow; children?: ReactNode }) {
  const since = row.retired_week ? weekLabel(row.retired_week) : null;
  return (
    <Block
      aside={<Tag tone="out">Retired</Tag>}
      title={since ? `Retired since ${since}` : "Retired"}
    >
      <p className="text-body text-ink-dim">
        {ACADEMY.retireWeeks} counted weeks without a game. Packs don&rsquo;t make{" "}
        {row.display_name}&rsquo;s card any more; copies stay owned and tradeable but can&rsquo;t
        play Midweek.
      </p>
      {row.progress > 0 && (
        <Inset className="grid gap-2">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-body font-semibold">Comeback</span>
            <span className="flex items-center gap-2 text-small text-ink-dim">
              <Progress credits={row.progress_credits} real={row.progress_weeks} />
              {progressWords(row.progress_weeks, row.progress_credits)}
            </span>
          </span>
          <span className="text-small text-ink-dim">
            {ACADEMY.promoteAt} counted weeks out of the last eight return them to the First Team,
            with the same card.
          </span>
        </Inset>
      )}
      {children}
      <InfoLink href={HOW_RETIRED}>When a Player retires</InfoLink>
    </Block>
  );
}

/** The stage block a First Team or Retired profile shows, or nothing. */
export function StageBlock({ row, copies }: { row: LifecycleRow | null; copies?: number }) {
  if (!row) return null;
  if (row.lifecycle_stage === "retired") return <RetiredBlock row={row} />;
  if (row.at_risk) return <AtRiskBlock copies={copies} row={row} />;
  return null;
}
