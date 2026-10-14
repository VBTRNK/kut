import { BRAND } from "@/lib/brand";

/** The brand mark keeps its own type (DR5 Q5). */
export function BrandLockup({ centred = false }: { centred?: boolean }) {
  return (
    <p className={centred ? "flex flex-col items-center gap-3" : "flex items-center gap-4"}>
      <span aria-hidden="true" className="clip-pennant h-20 w-[70px] shrink-0 bg-brass" />
      <span className={`grid gap-2 ${centred ? "text-center" : ""}`}>
        <span className="text-[40px] font-black leading-none tracking-[-0.02em] text-ink">
          {BRAND.shortName}
        </span>
        <span className="text-[0.7rem] font-extrabold uppercase leading-[1.45] tracking-[0.26em] text-brass">
          <span className="block">Football League</span>
          <span className="block">Ultimate Team</span>
        </span>
      </span>
    </p>
  );
}
