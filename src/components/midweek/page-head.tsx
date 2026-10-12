import Link from "next/link";

/** The Midweek pages' frame: the app's board ground and padding. */
export const MIDWEEK_PAGE = "board-ground min-h-screen p-5 text-ink sm:p-10";

/**
 * The compressed mobile page header (`nav-audit/MobileRules`): a kicker, a
 * 30 px title and, from `sm` only, the lede; with an optional back link.
 */
export function MidweekPageHead({
  kicker,
  title,
  lede,
  back,
}: {
  kicker: string;
  title: string;
  lede?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="space-y-3">
      {back && (
        <Link
          className="inline-block text-sm font-bold text-brass hover:underline"
          href={back.href}
        >
          &larr; {back.label}
        </Link>
      )}
      <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
        {kicker}
      </p>
      <h1 className="display text-3xl sm:text-6xl">{title}</h1>
      {lede && (
        <p className="hidden max-w-2xl text-[15px] leading-relaxed text-ink-dim sm:block">{lede}</p>
      )}
    </header>
  );
}
