/**
 * `MidweekSeed`, the fairness seal (§44.8 commit and reveal), folded away at
 * a page's foot (DR5-14): there to be checked, not to be noticed. `seedMatches`
 * is computed on the server once the seed is published (PR 8's complete week).
 */
export function MidweekSeed({
  seedHash,
  seed = null,
  seedMatches = false,
  defaultOpen = false,
}: {
  seedHash: string;
  seed?: string | null;
  seedMatches?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-2xl border border-line/60 px-4"
      open={defaultOpen || undefined}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-small font-semibold text-ink-dim [&::-webkit-details-marker]:hidden">
        Fairness seal
        <span aria-hidden="true" className="text-ink-faint">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">&minus;</span>
        </span>
      </summary>
      <div className="grid gap-2 pb-4">
        <p className="text-small text-pretty text-ink-dim">
          This week&rsquo;s draws were fixed before anyone picked. The seal is a fingerprint
          (SHA-256) of a secret seed; the seed is published once the final is shown, so anyone can
          check the fingerprint matches and nobody, admins included, could have re-rolled the week.
        </p>
        <code className="font-mono text-label break-all text-ink-faint">seal {seedHash}</code>
        {seed && <code className="font-mono text-label break-all text-ink-faint">seed {seed}</code>}
        {seed && seedMatches && (
          <p className="text-small text-ink-dim">
            <span className="font-semibold text-moss">&#10003; Matches the seal.</span> SHA-256 of
            the seed is the seal above.
          </p>
        )}
      </div>
    </details>
  );
}
