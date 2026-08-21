import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { Meta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MetaNote from "@/components/MetaNote";

export type Mode = "route" | "exposure";

const TAGLINE: Record<Mode, string> = {
  route:
    "Plan a drive that steers around license-plate cameras. See exactly who logs you — and what it costs to avoid them.",
  exposure: "Tap anywhere to see how heavily surveilled that spot is.",
};

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
  // Collapse only affects the mobile bottom sheet; desktop always shows content.
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "glass scroll-thin fixed z-10 overflow-y-auto border-border shadow-2xl",
        // mobile: bottom sheet
        "inset-x-0 bottom-0 max-h-[82dvh] rounded-t-2xl border-t",
        // desktop: floating card, top-left
        "sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-4 sm:max-h-[calc(100dvh-2rem)] sm:w-[372px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border",
      )}
    >
      {/* grab handle — mobile only, taps to collapse/expand */}
      <button
        type="button"
        className="sticky top-0 z-10 flex w-full justify-center bg-transparent py-2 sm:hidden"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="h-1 w-9 rounded-full bg-white/25" />
      </button>

      <div className="px-[18px] pb-5 pt-1 sm:pt-[18px]">
        <div className="flex items-baseline gap-2.5">
          <span
            className="size-2.5 self-center rounded-full bg-alert"
            style={{ boxShadow: "0 0 0 4px rgba(255,77,94,0.18)" }}
          />
          <h1 className="text-[22px] font-bold tracking-tight">Unwatched</h1>
          {cityName && (
            <Link
              to="/"
              aria-label="Change city"
              className="ml-auto self-center rounded-full border border-border bg-white/[0.06] px-2.5 py-[3px] text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              {cityName} ▾
            </Link>
          )}
          {/* mobile collapse chevron */}
          <button
            type="button"
            className={cn("ml-1 self-center text-muted-foreground transition-transform sm:hidden", !collapsed && "rotate-180")}
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setCollapsed((c) => !c)}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        <p className="mb-3.5 mt-1.5 text-[12.5px] leading-normal text-muted-foreground">
          {TAGLINE[mode]}
        </p>

        <Tabs value={mode} onValueChange={(v) => onMode(v as Mode)} className="mb-4">
          <TabsList aria-label="Mode">
            <TabsTrigger value="route">Plan a route</TabsTrigger>
            <TabsTrigger value="exposure">Exposure score</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* collapsible on mobile; always visible on desktop */}
        <div className={cn(collapsed ? "hidden sm:block" : "block")}>
          {children}
          <MetaNote meta={meta} />
        </div>
      </div>
    </div>
  );
}
