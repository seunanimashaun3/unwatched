import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { CityIndexEntry } from "@/lib/types";

function Stat({ num, unit }: { num: number; unit: string }) {
  return (
    <div>
      <span className="block text-[22px] font-bold leading-tight tabular-nums text-alert">
        {num.toLocaleString()}
      </span>
      <span className="text-[11px] text-muted-foreground">{unit}</span>
    </div>
  );
}

export default function CityCard({ city }: { city: CityIndexEntry }) {
  return (
    <Link
      to={`/${city.slug}`}
      className="group flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-[18px] text-card-foreground transition-all hover:-translate-y-0.5 hover:border-alert/50 hover:bg-alert/[0.05]"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[19px] font-bold tracking-tight">{city.city}</span>
        <span className="text-xs font-semibold text-faint">{city.state}</span>
      </div>
      <div className="flex gap-5">
        <Stat num={city.counts.alpr} unit="plate readers" />
        <Stat num={city.counts.cameras} unit="cameras mapped" />
      </div>
      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-safe">
        Plan a route
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
