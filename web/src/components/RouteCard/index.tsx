import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { fmtDistance, fmtDuration } from "@/lib/geo";

function Stat({ value, unit, className }: { value: string; unit: string; className?: string }) {
  return (
    <div>
      <div className={cn("text-xl font-bold tracking-tight tabular-nums", className)} data-testid={unit === "cameras" ? "cam-count" : undefined}>
        {value}
      </div>
      <div className="mt-px text-[10.5px] uppercase tracking-wide text-faint">{unit}</div>
    </div>
  );
}

export default function RouteCard({
  kind,
  title,
  time,
  dist,
  cams,
  selected,
  onSelect,
}: {
  kind: "fast" | "priv";
  title: string;
  time: number;
  dist: number;
  cams: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <Card
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? (e) => (e.key === "Enter" || e.key === " ") && onSelect() : undefined}
      className={cn(
        "p-3.5 transition-all",
        onSelect && "cursor-pointer",
        kind === "priv" ? "border-safe/40 bg-safe/[0.06]" : "bg-foreground/[0.02]",
        selected && "ring-2 ring-offset-1 ring-offset-transparent",
        selected && (kind === "priv" ? "ring-safe" : "ring-alert"),
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="h-1 w-3.5 rounded-full"
          style={{ background: kind === "priv" ? "#35e0a1" : "#8b95a7" }}
        />
        <span className="text-[13px] font-bold">{title}</span>
        {selected && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">cameras shown</span>}
      </div>
      <div className="flex gap-4">
        <Stat value={fmtDuration(time)} unit="time" />
        <Stat value={fmtDistance(dist)} unit="distance" />
        <Stat
          value={String(cams)}
          unit="cameras"
          className={cams === 0 ? "text-safe" : "text-alert"}
        />
      </div>
    </Card>
  );
}
