import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { fmtDistance, fmtDuration } from "@/lib/geo";

function Stat({ value, unit, valueClass }: { value: string; unit: string; valueClass?: string }) {
  return (
    <div>
      <div
        className={cn("font-mono text-lg font-bold leading-none", valueClass)}
        data-testid={unit === "cameras" ? "cam-count" : undefined}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-faint">{unit}</div>
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
  const priv = kind === "priv";
  return (
    <Card
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? (e) => (e.key === "Enter" || e.key === " ") && onSelect() : undefined}
      className={cn(
        "p-4 transition-all",
        onSelect && "cursor-pointer hover:border-foreground/20",
        priv ? "border-safe/40 bg-safe/[0.05]" : "bg-foreground/[0.02]",
        selected && (priv ? "ring-2 ring-safe" : "ring-2 ring-brand"),
      )}
    >
      <div className="mb-3.5 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: priv ? "#10b981" : "#5b53ff" }} />
        <span className="text-[13.5px] font-bold tracking-tight">{title}</span>
        {selected && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Check className="size-3" /> shown
          </span>
        )}
      </div>
      <div className="flex items-start justify-between">
        <Stat value={String(cams)} unit="cameras" valueClass={cams === 0 ? "text-safe" : "text-alert"} />
        <Stat value={fmtDuration(time)} unit="time" />
        <Stat value={fmtDistance(dist)} unit="distance" />
      </div>
    </Card>
  );
}
