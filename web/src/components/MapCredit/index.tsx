import { cn } from "@/lib/utils";

/**
 * Minimal, fully-controlled map attribution (replaces MapLibre's control, which
 * rendered a big expanded box on mobile). OSM credit is required; the full data
 * source list lives in the Privacy & terms dialog.
 */
export default function MapCredit({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-auto absolute bottom-1 left-1.5 z-[5] rounded bg-card/70 px-1.5 py-0.5 text-[9.5px] leading-none text-faint backdrop-blur-sm",
        className,
      )}
    >
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="hover:text-muted-foreground"
      >
        © OpenStreetMap
      </a>
      <span className="mx-1 opacity-60">·</span>
      <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="hover:text-muted-foreground">
        OpenFreeMap
      </a>
    </div>
  );
}
