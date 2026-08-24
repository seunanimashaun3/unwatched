import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { OVERLAYS, type OverlayVar } from "@/lib/demographics";

/**
 * On-map switcher for the demographic *context* overlay (income / race /
 * poverty / 1930s redlining) with a legend and an honesty caveat.
 *
 * Anchored to stay clear of the other chrome: bottom-right on desktop (the
 * route panel owns the left), top-left on mobile (the sheet owns the bottom).
 * Only shown for cities that have the data.
 */
export default function DemographicsControl({
  options,
  overlay,
  onChange,
  retrieved,
}: {
  options: OverlayVar[];
  overlay: OverlayVar | null;
  onChange: (v: OverlayVar | null) => void;
  /** ISO date the city's data was pulled (from the file's meta). */
  retrieved?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!options.length) return null;
  const active = overlay ? OVERLAYS[overlay] : null;

  return (
    <div className="absolute left-3 top-3 z-20 flex w-[min(16.5rem,calc(100vw-1.5rem))] flex-col gap-2 sm:bottom-4 sm:left-auto sm:right-4 sm:top-auto sm:flex-col-reverse">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="glass flex items-center gap-2 self-start rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold shadow-lg sm:self-end"
      >
        <Layers className="size-4 text-primary" />
        <span className="max-w-[9rem] truncate">{overlay ? OVERLAYS[overlay].label : "Demographics"}</span>
        {overlay && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        <ChevronDown className={cn("size-3.5 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="glass max-h-[58vh] overflow-y-auto rounded-2xl border border-border p-3.5 shadow-2xl">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Demographic context
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip active={overlay === null} onClick={() => onChange(null)}>
              None
            </Chip>
            {options.map((v) => (
              <Chip key={v} active={overlay === v} onClick={() => onChange(v)}>
                {OVERLAYS[v].label}
              </Chip>
            ))}
          </div>

          {active && (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {active.legend.map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="truncate text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 border-t border-border pt-2 text-[10.5px] leading-snug text-faint">
                Source:{" "}
                <a
                  href={active.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {active.source}
                </a>
                {retrieved && ` · retrieved ${fmtRetrieved(retrieved)}`}.
                <br />
                <b className="text-muted-foreground">Context, not a claim</b> — where cameras sit isn't the same
                as who gets logged (traffic + coverage bias).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtRetrieved(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(+d) ? iso : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:border-ring hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
