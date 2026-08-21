import type { Meta } from "@/lib/types";

export default function MetaNote({ meta }: { meta: Meta | null }) {
  if (!meta) return null;
  return (
    <p className="mt-4 border-t border-border pt-3 text-[10.5px] leading-relaxed text-faint [&_b]:text-muted-foreground">
      Roads from <b>Overture Maps</b> ({meta.overtureRelease}). Cameras are
      crowdsourced via <b>DeFlock / OpenStreetMap</b> — a <b>known-incomplete</b>{" "}
      lower bound, so real coverage is higher.{" "}
      {meta.counts.alpr.toLocaleString()} plate readers &{" "}
      {meta.counts.cameras.toLocaleString()} cameras mapped in {meta.city}.
    </p>
  );
}
