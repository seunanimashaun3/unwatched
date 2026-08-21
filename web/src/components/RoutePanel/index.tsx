import { Loader2 } from "lucide-react";
import type { LngLat, Preset, RouteResponse } from "@/lib/types";
import type { Bbox } from "@/lib/geocode";
import { detourLabel } from "@/lib/verdict";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SearchBox from "@/components/SearchBox";
import Results, { Verdict } from "@/components/Results";

export type Arm = "a" | "b" | null;

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
    {children}
  </div>
);

export default function RoutePanel({
  start,
  end,
  startLabel,
  endLabel,
  arm,
  setArm,
  bbox,
  presets,
  onSelect,
  onClear,
  penaltyS,
  setPenaltyS,
  alprOnly,
  setAlprOnly,
  routing,
  result,
  applyPreset,
  reset,
}: {
  start: LngLat | null;
  end: LngLat | null;
  startLabel: string | null;
  endLabel: string | null;
  arm: Arm;
  setArm: (a: Arm) => void;
  bbox: Bbox;
  presets: Preset[];
  onSelect: (kind: "a" | "b", point: LngLat, label: string) => void;
  onClear: (kind: "a" | "b") => void;
  penaltyS: number;
  setPenaltyS: (n: number) => void;
  alprOnly: boolean;
  setAlprOnly: (b: boolean) => void;
  routing: boolean;
  result: RouteResponse | null;
  applyPreset: (a: LngLat, b: LngLat) => void;
  reset: () => void;
}) {
  return (
    <>
      <SectionLabel>Route</SectionLabel>
      <SearchBox kind="a" label="Start" valueLabel={startLabel} armed={arm === "a"} bbox={bbox} onArm={() => setArm("a")} onSelect={(p, l) => onSelect("a", p, l)} onClear={() => onClear("a")} />
      <SearchBox kind="b" label="Destination" valueLabel={endLabel} armed={arm === "b"} bbox={bbox} onArm={() => setArm("b")} onSelect={(p, l) => onSelect("b", p, l)} onClear={() => onClear("b")} />

      {!start && !end && presets.length > 0 && (
        <div className="mb-3.5 mt-0.5">
          <div className="mb-2 text-[11.5px] text-faint">Or try an example:</div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                className="rounded-full text-[11.5px]"
                onClick={() => applyPreset(p.a, p.b)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="my-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold">Detour tolerance</span>
          <span className="text-[11px] text-muted-foreground">{detourLabel(penaltyS)}</span>
        </div>
        <Slider
          aria-label="Detour tolerance"
          min={0}
          max={300}
          step={15}
          value={[penaltyS]}
          onValueChange={(v) => setPenaltyS(v[0])}
        />
      </div>

      <div className="mb-3.5 flex items-center gap-2.5">
        <Switch id="alpr-only" checked={alprOnly} onCheckedChange={setAlprOnly} />
        <Label htmlFor="alpr-only" className="cursor-pointer text-[12.5px] font-normal text-muted-foreground">
          Only avoid license-plate readers (ALPR), not all cameras
        </Label>
      </div>

      {routing && (
        <Verdict>
          <Loader2 className="mr-1.5 inline size-3.5 animate-spin align-[-2px] text-safe" aria-hidden="true" />
          Finding the least-watched route…
        </Verdict>
      )}

      {!routing && result && !result.ok && (
        <Verdict role="alert">{result.reason}</Verdict>
      )}

      {!routing && result?.ok && result.fast && result.private && (
        <Results fast={result.fast} priv={result.private} />
      )}

      {(start || end) && (
        <Button variant="outline" className="mt-2.5 w-full" onClick={reset}>
          Clear route
        </Button>
      )}
    </>
  );
}
