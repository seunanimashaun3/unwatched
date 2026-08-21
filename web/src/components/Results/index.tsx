import type { RouteResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtDuration } from "@/lib/geo";
import { summarizeRoutes } from "@/lib/verdict";
import RouteCard from "@/components/RouteCard";

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
          ? "border-safe/25 bg-safe/10 text-[#cffbe9] [&_b]:text-white"
          : "border-border bg-white/[0.04] text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

export default function Results({ fast, priv }: { fast: RouteResult; priv: RouteResult }) {
  const v = summarizeRoutes(fast, priv);

  return (
    <>
      <div className="mt-1 grid gap-2.5">
        <RouteCard kind="fast" title="Fastest route" time={fast.timeS} dist={fast.distanceM} cams={fast.cameras.length} />
        <RouteCard kind="priv" title="Least-watched route" time={priv.timeS} dist={priv.distanceM} cams={priv.cameras.length} />
      </div>

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
    </>
  );
}
