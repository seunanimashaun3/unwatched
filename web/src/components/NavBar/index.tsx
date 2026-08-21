import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NavBar({
  nextName,
  nextDistanceM,
  loggedCount,
  speedMph,
  onEnd,
}: {
  nextName: string | null;
  nextDistanceM: number | null;
  loggedCount: number;
  speedMph: number | null;
  onEnd: () => void;
}) {
  return (
    <div className="glass fixed inset-x-0 top-0 z-20 flex items-center gap-3 border-b border-border px-4 py-3 shadow-lg">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">
          Next plate reader
        </div>
        {nextName && nextDistanceM !== null ? (
          <div className="truncate text-sm font-bold">
            {nextName} · <span className="text-alert tabular-nums">{Math.round(nextDistanceM)} m</span>
          </div>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground">None nearby</div>
        )}
      </div>

      {speedMph !== null && (
        <div className="text-center">
          <div className="text-lg font-bold leading-none tabular-nums">{Math.round(speedMph)}</div>
          <div className="text-[10px] text-faint">mph</div>
        </div>
      )}

      <div className="text-center">
        <div className="text-lg font-bold leading-none tabular-nums text-alert">{loggedCount}</div>
        <div className="text-[10px] text-faint">logged</div>
      </div>

      <Button variant="destructive" size="sm" className="gap-1" onClick={onEnd}>
        <X className="size-3.5" />
        End
      </Button>
    </div>
  );
}
