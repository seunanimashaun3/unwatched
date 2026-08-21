import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Meta } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MetaNote from "@/components/MetaNote";
import ThemeToggle from "@/components/ThemeToggle";

export type Mode = "route" | "exposure";

const TAGLINE: Record<Mode, string> = {
  route:
    "Plan a drive that steers around license-plate cameras. See exactly who logs you — and what it costs to avoid them.",
  exposure: "Tap anywhere to see how heavily surveilled that spot is.",
};

/** Desktop floating card. The mobile experience is a separate MobilePanel. */
export default function Panel({
  mode,
  onMode,
  meta,
  cityName,
  children,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  meta: Meta | null;
  cityName?: string;
  children: ReactNode;
}) {
  return (
    <div className="glass scroll-thin fixed left-4 top-4 z-10 max-h-[calc(100dvh-2rem)] w-[372px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border shadow-2xl">
      <div className="px-[18px] pb-5 pt-[18px]">
        <div className="flex items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-full bg-alert"
            style={{ boxShadow: "0 0 0 4px rgba(255,77,94,0.18)" }}
          />
          <h1 className="text-[22px] font-bold tracking-tight">Unwatched</h1>
          <div className="ml-auto flex items-center gap-2">
            {cityName && (
              <Link
                to="/"
                aria-label="Change city"
                className="rounded-full border border-border bg-foreground/[0.06] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
              >
                {cityName} ▾
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>

        <p className="mb-3.5 mt-2 text-[12.5px] leading-normal text-muted-foreground">
          {TAGLINE[mode]}
        </p>

        <Tabs value={mode} onValueChange={(v) => onMode(v as Mode)} className="mb-4">
          <TabsList aria-label="Mode">
            <TabsTrigger value="route">Plan a route</TabsTrigger>
            <TabsTrigger value="exposure">Exposure score</TabsTrigger>
          </TabsList>
        </Tabs>

        {children}

        <MetaNote meta={meta} />
      </div>
    </div>
  );
}
