import type { PackKind } from "@/lib/packs";

const NAME: Record<PackKind, string | null> = {
  regular: "Regular",
  silver: "Silver",
  gold: "Gold",
  neutral: null,
};

/**
 * A pack's wrapper (#223, `design/pack-tiers/BRIEF.md`). Each borrows its
 * material from the Live card ladder in globals.css: Regular is the Common's
 * uncoated stock with the brass pennant printed on it, Silver the Silver
 * plate's brushed metal, Gold the Gold card's hot foil. Shape differs too, so
 * the three stay apart in grayscale: crimped paper, a notched sleeve, a sealed
 * wallet. An unknown slug gets plain paper with no name or pennant. Purely
 * decorative: the offer's text names the pack.
 */
export function PackArt({
  kind,
  cards = 3,
  className = "",
}: {
  kind: PackKind;
  cards?: number;
  className?: string;
}) {
  const name = NAME[kind];
  const label = (
    <span className="pack__label">
      {name && <b>{name}</b>}
      <span>{cards} Live Cards</span>
    </span>
  );
  return (
    <div aria-hidden="true" className={`pack ${className}`} data-pack={kind}>
      <span className="pack__glow" />
      <span className="pack__cards">
        <i />
        <i />
        <i />
      </span>
      {(kind === "regular" || kind === "neutral") && (
        <>
          <span className="pack__wrap">
            <span className="pack__mark">FLUT</span>
            {kind === "regular" && <span className="pack__print clip-pennant" />}
            {label}
          </span>
          <span className="pack__strip" />
        </>
      )}
      {kind === "silver" && (
        <>
          <span className="pack__inner" />
          <span className="pack__wrap">
            <span className="pack__mark">FLUT</span>
            <span className="pack__badge">
              <span className="live-card__tier-icon live-card__tier-icon--silver" />
            </span>
            {label}
            <span className="pack__sheen" />
          </span>
        </>
      )}
      {kind === "gold" && (
        <>
          <span className="pack__wrap">
            {(["l", "r"] as const).map((side) => (
              <span className={`pack__door pack__door--${side}`} key={side}>
                <span className="pack__doorface">
                  <span className="pack__mark">FLUT</span>
                  {label}
                  <span className="pack__sheen" />
                </span>
              </span>
            ))}
          </span>
          <span className="pack__seal">
            <span className="clip-pennant" />
          </span>
        </>
      )}
    </div>
  );
}
