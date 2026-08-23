import { cn } from "@/lib/utils";
import { fmtDistance } from "@/lib/geo";
import { exposureBand, type Exposure } from "@/lib/exposure";

const SCORE_COLOR: Record<string, string> = {
  low: "text-safe",
  med: "text-[#ffcc55]",
  high: "text-alert",
};

export default function ExposurePanel({ exposure }: { exposure: Exposure | null }) {
  if (!exposure) {
    return (
      <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
        Tap anywhere on the map to measure how many surveillance cameras watch
        that spot within a 5-minute walk.
      </p>
    );
  }
  const band = exposureBand(exposure.alpr);
  return (
    <>
      <div className="pb-1.5 pt-4 text-center">
        <div
          className={cn("font-mono text-[54px] font-bold leading-none tracking-tight", SCORE_COLOR[band.cls])}
          data-testid="exposure-score"
        >
          {exposure.alpr}
        </div>
        <div className="mt-1.5 text-[12.5px] text-muted-foreground">
          ALPR cameras within a 5-min walk
          <br />
          {band.label}
        </div>
      </div>
      <div className="mt-3.5 grid gap-1.5">
        <Row label="License-plate readers (ALPR)" value={exposure.alpr} />
        <Row label="…of which Flock-branded" value={exposure.flock} />
        <Row label="All surveillance cameras" value={exposure.total} />
        <Row label="Nearest plate reader" value={exposure.nearest === null ? "—" : fmtDistance(exposure.nearest)} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}
