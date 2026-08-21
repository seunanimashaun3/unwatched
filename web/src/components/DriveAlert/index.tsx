import { AlertTriangle, X } from "lucide-react";

export default function DriveAlert({
  title,
  distanceM,
  onDismiss,
}: {
  title: string;
  distanceM: number;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="glass fixed inset-x-0 top-4 z-30 mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-2xl border border-alert/50 bg-destructive/20 px-4 py-3 shadow-2xl"
    >
      <AlertTriangle className="size-6 shrink-0 text-alert" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-foreground">{title} ahead</div>
        <div className="text-xs text-muted-foreground">
          ~{Math.round(distanceM)} m — you're about to be logged
        </div>
      </div>
      <button aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onDismiss}>
        <X className="size-4" />
      </button>
    </div>
  );
}
