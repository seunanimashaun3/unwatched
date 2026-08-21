import { useState } from "react";
import { ChevronDown, LocateFixed, Loader2 } from "lucide-react";
import type { CityIndexEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { nearestCity } from "@/lib/proximity";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function CitySwitcher({
  cities,
  slug,
  onChange,
}: {
  cities: CityIndexEntry[];
  slug: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const geo = useGeolocation();
  const current = cities.find((c) => c.slug === slug);

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
  };

  const useNearest = () => {
    setLocating(true);
    geo
      .locateOnce()
      .then((f) => {
        const n = nearestCity(f.point, cities);
        if (n) pick(n.slug);
      })
      .catch(() => {})
      .finally(() => setLocating(false));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Switch city"
          className="flex items-center gap-1 rounded-full border border-border bg-foreground/[0.06] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
        >
          {current ? `${current.city}, ${current.state}` : "Select city"}
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70dvh] overflow-y-auto">
        <button
          onClick={useNearest}
          disabled={locating}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-accent"
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          Nearest to me
        </button>
        <div className="my-1 h-px bg-border" />
        {cities.map((c) => (
          <button
            key={c.slug}
            onClick={() => pick(c.slug)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent",
              c.slug === slug && "bg-accent font-semibold",
            )}
          >
            <span className="truncate">
              {c.city}, {c.state}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-alert">{c.counts.alpr} ALPR</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
