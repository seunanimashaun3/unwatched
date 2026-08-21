import { Loader2 } from "lucide-react";

export default function LoadingScreen({ label = "Loading road network…" }: { label?: string }) {
  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-background"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <h1 className="mb-1.5 text-3xl font-bold tracking-tight">Unwatched</h1>
        <p className="mb-5 text-sm text-muted-foreground">{label}</p>
        <Loader2 className="mx-auto size-8 animate-spin text-safe" aria-hidden="true" />
      </div>
    </div>
  );
}
