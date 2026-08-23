import type { Camera, RouteResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtDuration } from "@/lib/geo";
import { summarizeRoutes } from "@/lib/verdict";
import RouteCard from "@/components/RouteCard";
import CommuteExposure from "@/components/CommuteExposure";

export function Verdict({
  tone = "neutral",
  children,
  role = "status",
}: {
  tone?: "win" | "neutral";
  children: React.ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className={cn(
        "mt-3 rounded-lg border p-3 text-[12.5px] leading-relaxed",
        tone === "win"
          ? "border-safe/30 bg-safe/10 text-foreground [&_b]:text-foreground [&_b]:font-bold"
          : "border-border bg-foreground/[0.04] text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

export type SelectedRoute = "fast" | "private";

export default function Results({
  fast,
  priv,
  selected = "private",
  onSelectRoute,
  cameras,
  city,
}: {
  fast: RouteResult;
  priv: RouteResult;
  selected?: SelectedRoute;
  onSelectRoute?: (r: SelectedRoute) => void;
  cameras?: Camera[];
  city?: string;
}) {
  const v = summarizeRoutes(fast, priv);

  return (
    <>
      <div className="mt-1 grid gap-2.5">
        <RouteCard
          kind="fast"
          title="Fastest route"
          time={fast.timeS}
          dist={fast.distanceM}
          cams={fast.cameras.length}
          selected={selected === "fast"}
          onSelect={onSelectRoute ? () => onSelectRoute("fast") : undefined}
        />
        <RouteCard
          kind="priv"
          title="Least-watched route"
          time={priv.timeS}
          dist={priv.distanceM}
          cams={priv.cameras.length}
          selected={selected === "private"}
          onSelect={onSelectRoute ? () => onSelectRoute("private") : undefined}
        />
      </div>
      {onSelectRoute && (
        <p className="mt-1.5 text-[11px] text-faint">Tap a route to highlight its cameras on the map.</p>
      )}

      {v.kind === "identical" ? (
        <Verdict>
          The fastest route is already the least-watched one — no camera-free
          detour saves you here.
        </Verdict>
      ) : v.kind === "win" ? (
        <Verdict tone="win">
          Detouring <b>+{fmtDuration(Math.max(0, v.extraTimeS))}</b> avoids{" "}
          <b>
            {v.savedCameras} camera{v.savedCameras === 1 ? "" : "s"}
          </b>
          {fast.cameras.length > 0 && (
            <>
              {" "}
              — from being logged <b>{fast.cameras.length}×</b> down to{" "}
              <b>{priv.cameras.length}×</b>.
            </>
          )}
        </Verdict>
      ) : (
        <Verdict>No detour avoids more cameras than the fastest route already does.</Verdict>
      )}

      {cameras && city && (
        <CommuteExposure route={selected === "fast" ? fast : priv} cameras={cameras} city={city} />
      )}
    </>
  );
}
