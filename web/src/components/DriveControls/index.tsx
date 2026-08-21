import { LocateFixed, Loader2, Navigation, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DriveControls({
  locating,
  driveMode,
  watching,
  loggedCount,
  accuracyM,
  error,
  onLocate,
  onToggleDrive,
  onStart,
}: {
  locating: boolean;
  driveMode: boolean;
  watching: boolean;
  loggedCount: number;
  accuracyM: number | null;
  error: string | null;
  onLocate: () => void;
  onToggleDrive: (on: boolean) => void;
  onStart: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onLocate} disabled={locating}>
          {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
          Use my location
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Navigation className={cn("size-3.5", driveMode ? "text-safe" : "text-faint")} />
          <Label htmlFor="drive-mode" className="cursor-pointer text-[12.5px] text-muted-foreground">
            Drive mode
          </Label>
          <Switch id="drive-mode" checked={driveMode} onCheckedChange={onToggleDrive} />
        </div>
      </div>

      {driveMode && (
        <div className="mt-2.5 border-t border-border pt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", watching ? "animate-pulse bg-safe" : "bg-faint")} />
              {watching ? "Following your location" : "Waiting for GPS…"}
            </span>
            <span className="tabular-nums">
              logged <b className="text-alert">{loggedCount}×</b>
            </span>
          </div>
          {accuracyM !== null && watching && (
            <div className="mt-1 text-faint">± {Math.round(accuracyM)} m accuracy</div>
          )}
          <div className="mt-1.5 text-faint">
            ⚠️ Warns about <b>known</b> cameras only. Have a passenger operate this — don't watch the screen while driving.
          </div>
          <Button className="mt-3 h-11 w-full gap-1.5" onClick={onStart} disabled={!watching}>
            <Play className="size-4" />
            Start driving
          </Button>
        </div>
      )}

      {error && <div className="mt-2 text-[11.5px] text-alert">{error}</div>}
    </div>
  );
}
