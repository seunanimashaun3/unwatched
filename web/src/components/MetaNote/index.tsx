import type { Meta } from "@/lib/types";

/** ISO "2026-08-27" -> "Aug 27, 2026" (noon-anchored to avoid TZ off-by-one). */
export function fmtRefreshed(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(+d)
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function MetaNote({ meta }: { meta: Meta | null }) {
  if (!meta) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      {meta.refreshed && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-safe" />
          Camera data updated {fmtRefreshed(meta.refreshed)}
        </p>
      )}
      <p className="text-[10.5px] leading-relaxed text-faint [&_b]:text-muted-foreground">
        Roads from <b>Overture Maps</b> ({meta.overtureRelease}). Cameras are crowdsourced via{" "}
        <b>DeFlock / OpenStreetMap</b> — a <b>known-incomplete</b> lower bound, so real coverage is higher.{" "}
        {meta.counts.alpr.toLocaleString()} plate readers & {meta.counts.cameras.toLocaleString()} cameras mapped in{" "}
        {meta.city}.
      </p>
    </div>
  );
}
