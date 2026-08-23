import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import type { Camera, RouteResult } from "@/lib/types";
import { commuteExposure } from "@/lib/logging";
import { shareExposure } from "@/lib/shareCard";

/**
 * The personal, visceral version of the camera count: how many times the
 * selected route gets you logged by plate readers per year, and by whom — with
 * a one-tap share card.
 */
export default function CommuteExposure({
  route,
  cameras,
  city,
}: {
  route: RouteResult;
  cameras: Camera[];
  city: string;
}) {
  const [sharing, setSharing] = useState(false);
  const x = commuteExposure(route, cameras);

  if (x.perTrip === 0) {
    return (
      <div className="mt-3 rounded-lg border border-safe/30 bg-safe/10 p-3 text-[12.5px] leading-relaxed">
        This route keeps you off <b className="font-semibold">every mapped plate reader</b> — zero logged
        crossings each way.
      </div>
    );
  }

  const share = () => {
    setSharing(true);
    shareExposure({ perYear: x.perYear, perTrip: x.perTrip, agencies: x.agencies.length, city })
      .catch(() => {})
      .finally(() => setSharing(false));
  };

  return (
    <div className="mt-3 rounded-lg border border-alert/25 bg-alert/[0.06] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        Your exposure on this route
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabnum font-mono text-[26px] font-bold leading-none text-alert">
          {x.perYear.toLocaleString()}×
        </span>
        <span className="text-[12px] text-muted-foreground">logged per year</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
        <b className="text-foreground">{x.perTrip}×</b> each way, commuting 5 days a week — by{" "}
        <b className="text-foreground">
          {x.agencies.length || "unmapped"} {x.agencies.length === 1 ? "agency" : "agencies"}
        </b>
        {x.hasUnknown && x.agencies.length > 0 ? ", plus unnamed operators" : ""}.
      </p>
      {x.agencies.length > 0 && (
        <p className="mt-1 truncate text-[11px] text-faint" title={x.agencies.join(" · ")}>
          {x.agencies.join(" · ")}
        </p>
      )}
      <button
        onClick={share}
        disabled={sharing}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:border-ring disabled:opacity-60"
      >
        {sharing ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
        Share this
      </button>
    </div>
  );
}
