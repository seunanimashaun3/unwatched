import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { ChevronDown, Loader2, Navigation2, SlidersHorizontal } from "lucide-react";
import type { Exposure } from "@/lib/exposure";
import type { LngLat, Preset, RouteResponse } from "@/lib/types";
import type { Bbox } from "@/lib/geocode";
import { cn } from "@/lib/utils";
import { detourLabel } from "@/lib/verdict";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchBox from "@/components/SearchBox";
import Results, { Verdict } from "@/components/Results";
import ExposurePanel from "@/components/ExposurePanel";
import ThemeToggle from "@/components/ThemeToggle";
import type { Mode } from "@/components/Panel";
import type { Arm } from "@/components/RoutePanel";

const SNAP_POINTS = [0.2, 0.92];

export interface MobilePanelProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  citySwitcher: ReactNode;
  // route
  start: LngLat | null;
  end: LngLat | null;
  startLabel: string | null;
  endLabel: string | null;
  arm: Arm;
  setArm: (a: Arm) => void;
  bbox: Bbox;
  presets: Preset[];
  onSelect: (kind: "a" | "b", p: LngLat, label: string) => void;
  onClear: (kind: "a" | "b") => void;
  penaltyS: number;
  setPenaltyS: (n: number) => void;
  alprOnly: boolean;
  setAlprOnly: (b: boolean) => void;
  routing: boolean;
  result: RouteResponse | null;
  applyPreset: (a: LngLat, b: LngLat) => void;
  reset: () => void;
  // drive + locate
  onLocate: () => void;
  locating: boolean;
  onStartDrive: () => void;
  // exposure
  exposure: Exposure | null;
}

export default function MobilePanel(props: MobilePanelProps) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);
  const [showOptions, setShowOptions] = useState(false);
  const expand = () => setSnap((s) => (s === SNAP_POINTS[0] ? SNAP_POINTS[1] : s));

  const hasRoute = props.result?.ok && props.result.fast && props.result.private;

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapToSequentialPoint
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content className="glass fixed inset-x-0 bottom-0 z-20 flex h-full max-h-[94dvh] flex-col rounded-t-2xl border-t border-border shadow-2xl outline-none">
          <Drawer.Handle className="!mt-3 !h-1.5 !w-10 !bg-foreground/25" />
          <Drawer.Title className="sr-only">Route planner</Drawer.Title>

          {/* compact header */}
          <div className="flex items-center gap-2 px-4 pb-2 pt-2.5">
            <span className="size-2.5 rounded-full bg-alert" />
            <span className="text-[15px] font-bold tracking-tight">Unwatched</span>
            <div className="ml-auto flex items-center gap-2">
              {props.citySwitcher}
              <ThemeToggle />
            </div>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-8" onFocusCapture={expand}>
            <Tabs value={props.mode} onValueChange={(v) => props.onMode(v as Mode)} className="mb-3">
              <TabsList aria-label="Mode">
                <TabsTrigger value="route">Plan a route</TabsTrigger>
                <TabsTrigger value="exposure">Exposure</TabsTrigger>
              </TabsList>
            </Tabs>

            {props.mode === "route" ? (
              <>
                <SearchBox
                  kind="a"
                  label="Start"
                  valueLabel={props.startLabel}
                  armed={props.arm === "a"}
                  bbox={props.bbox}
                  onArm={() => props.setArm("a")}
                  onSelect={(p, l) => props.onSelect("a", p, l)}
                  onClear={() => props.onClear("a")}
                  onLocate={props.onLocate}
                  locating={props.locating}
                />
                <SearchBox
                  kind="b"
                  label="Destination"
                  valueLabel={props.endLabel}
                  armed={props.arm === "b"}
                  bbox={props.bbox}
                  onArm={() => props.setArm("b")}
                  onSelect={(p, l) => props.onSelect("b", p, l)}
                  onClear={() => props.onClear("b")}
                />

                {!props.start && !props.end && props.presets.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {props.presets.map((p) => (
                      <Button
                        key={p.label}
                        variant="outline"
                        size="sm"
                        className="rounded-full text-[11.5px]"
                        onClick={() => props.applyPreset(p.a, p.b)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                )}

                {props.routing && (
                  <Verdict>
                    <Loader2 className="mr-1.5 inline size-3.5 animate-spin align-[-2px] text-safe" />
                    Finding the least-watched route…
                  </Verdict>
                )}
                {!props.routing && props.result && !props.result.ok && (
                  <Verdict role="alert">{props.result.reason}</Verdict>
                )}

                {hasRoute && (
                  <>
                    <div className="mt-3">
                      <Results fast={props.result!.fast!} priv={props.result!.private!} />
                    </div>

                    <Button className="mt-3 h-12 w-full gap-2 text-[15px]" onClick={props.onStartDrive}>
                      <Navigation2 className="size-4" />
                      Start driving
                    </Button>

                    <button
                      className="mt-3 flex w-full items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground"
                      onClick={() => setShowOptions((o) => !o)}
                    >
                      <SlidersHorizontal className="size-3.5" />
                      Route options
                      <ChevronDown className={cn("size-3.5 transition-transform", showOptions && "rotate-180")} />
                    </button>
                    {showOptions && (
                      <div className="mt-2.5 rounded-xl border border-border p-3">
                        <div className="mb-2 flex items-baseline justify-between">
                          <span className="text-[12.5px] font-semibold">Detour tolerance</span>
                          <span className="text-[11px] text-muted-foreground">{detourLabel(props.penaltyS)}</span>
                        </div>
                        <Slider
                          aria-label="Detour tolerance"
                          min={0}
                          max={300}
                          step={15}
                          value={[props.penaltyS]}
                          onValueChange={(v) => props.setPenaltyS(v[0])}
                        />
                        <div className="mt-3.5 flex items-center gap-2.5">
                          <Switch id="m-alpr" checked={props.alprOnly} onCheckedChange={props.setAlprOnly} />
                          <Label htmlFor="m-alpr" className="text-[12.5px] font-normal text-muted-foreground">
                            Avoid plate readers only (not all cameras)
                          </Label>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {(props.start || props.end) && (
                  <Button variant="outline" className="mt-3 h-11 w-full" onClick={props.reset}>
                    Clear
                  </Button>
                )}
              </>
            ) : (
              <ExposurePanel exposure={props.exposure} />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
