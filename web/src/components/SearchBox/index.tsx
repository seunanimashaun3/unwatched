import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, X } from "lucide-react";
import type { LngLat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { geocode, type Bbox, type GeoResult } from "@/lib/geocode";

export default function SearchBox({
  kind,
  label,
  valueLabel,
  armed,
  bbox,
  onArm,
  onSelect,
  onClear,
  onLocate,
  locating,
}: {
  kind: "a" | "b";
  label: string;
  valueLabel: string | null;
  armed: boolean;
  bbox: Bbox;
  onArm: () => void;
  onSelect: (point: LngLat, label: string) => void;
  onClear: () => void;
  /** when provided (start field), shows a "use my location" button */
  onLocate?: () => void;
  locating?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!focused || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await geocode(query, bbox, ctrl.signal);
      setResults(r);
      setActive(-1);
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, focused, bbox]);

  const shown = focused ? query : (valueLabel ?? "");
  const open = focused && (results.length > 0 || loading);

  function choose(r: GeoResult) {
    onSelect(r.point, r.label);
    setQuery("");
    setResults([]);
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className="relative mb-2.5 flex items-center gap-2.5">
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-[#05070a] sm:size-[22px]"
        style={{ background: kind === "a" ? "#ffffff" : "#10b981" }}
      >
        {kind.toUpperCase()}
      </span>
      <div className="relative min-w-0 flex-1">
        <Input
          value={shown}
          placeholder={armed ? "Search an address, or tap the map…" : label}
          aria-label={label}
          className={cn("h-11 text-[15px] sm:h-9 sm:text-sm", armed && "border-ring ring-2 ring-ring/40")}
          onFocus={() => {
            setFocused(true);
            setQuery(valueLabel ?? "");
            onArm();
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setFocused(false), 150);
          }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
            else if (e.key === "Enter" && results[active >= 0 ? active : 0])
              choose(results[active >= 0 ? active : 0]);
            else if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
        />
        {open && (
          <ul
            className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-2xl"
            onMouseDown={() => clearTimeout(blurTimer.current)}
          >
            {loading && results.length === 0 && (
              <li className="px-2.5 py-2 text-[12.5px] text-faint">Searching…</li>
            )}
            {results.map((r, i) => (
              <li
                key={r.label + i}
                className={cn(
                  "cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md px-2.5 py-3 text-sm sm:py-2 sm:text-[12.5px]",
                  i === active && "bg-accent",
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
              >
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {valueLabel && !focused ? (
        <button
          className="shrink-0 text-faint transition-colors hover:text-foreground"
          aria-label={`Clear ${label}`}
          onClick={onClear}
        >
          <X className="size-4" />
        </button>
      ) : (
        onLocate && (
          <button
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
            aria-label="Use my location"
            onClick={onLocate}
            disabled={locating}
          >
            {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          </button>
        )
      )}
    </div>
  );
}
