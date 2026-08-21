import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LocateFixed, Loader2 } from "lucide-react";
import type { CityIndexEntry } from "@/lib/types";
import { fetchCitiesIndex, REQUEST_CITY_URL } from "@/lib/cities";
import { nearestCity } from "@/lib/proximity";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CityCard from "@/components/CityCard";

export default function Home() {
  const [cities, setCities] = useState<CityIndexEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const geo = useGeolocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCitiesIndex()
      .then((d) => setCities(d.cities))
      .catch(() => setError(true));
  }, []);

  const useMyCity = () => {
    if (!cities) return;
    setLocating(true);
    geo
      .locateOnce()
      .then((f) => {
        const nearest = nearestCity(f.point, cities);
        if (nearest) navigate(`/${nearest.slug}`);
      })
      .catch(() => {})
      .finally(() => setLocating(false));
  };

  const filtered = useMemo(() => {
    if (!cities) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return cities;
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(needle) ||
        c.state.toLowerCase().includes(needle) ||
        c.slug.includes(needle),
    );
  }, [cities, q]);

  return (
    <div
      className="scroll-thin absolute inset-0 overflow-y-auto"
      style={{
        background:
          "radial-gradient(1200px 600px at 70% -10%, rgba(255,77,94,0.10), transparent), radial-gradient(900px 500px at 10% 110%, rgba(53,224,161,0.08), transparent), var(--background)",
      }}
    >
      <div className="mx-auto max-w-[940px] px-5 pb-16 pt-[clamp(2rem,8vh,5.5rem)]">
        <header className="mb-9">
          <div className="flex items-baseline gap-2.5">
            <span
              className="size-3 self-center rounded-full bg-alert"
              style={{ boxShadow: "0 0 0 5px rgba(255,77,94,0.18)" }}
            />
            <h1 className="text-[clamp(2.1rem,6vw,3.25rem)] font-bold tracking-tight">Unwatched</h1>
          </div>
          <p className="mt-3.5 max-w-[620px] text-[clamp(0.95rem,2.2vw,1.125rem)] leading-relaxed text-muted-foreground [&_b]:text-foreground">
            License-plate readers log where you drive, without a warrant. Pick
            your city, and plan a route that <b>steers around the cameras</b> —
            and see exactly what avoiding them costs.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <Input
            type="search"
            placeholder="Search a city…"
            aria-label="Search cities"
            className="h-11 max-w-[420px] flex-1 text-[15px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" className="h-11 gap-1.5" onClick={useMyCity} disabled={locating || !cities}>
            {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
            Nearest to me
          </Button>
        </div>
        {geo.error && <p className="-mt-3 mb-4 text-[12.5px] text-alert">{geo.error}</p>}

        {error && <p className="py-5 text-muted-foreground">Couldn't load the city list.</p>}
        {!error && cities === null && <p className="py-5 text-muted-foreground">Loading cities…</p>}

        {cities !== null && (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
              {filtered.map((c) => (
                <CityCard key={c.slug} city={c} />
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="py-5 text-muted-foreground">No supported city matches "{q}".</p>
            )}
          </>
        )}

        <footer className="mt-10 border-t border-border pt-5 text-[13px] text-muted-foreground">
          <p>
            Don't see your city?{" "}
            <a className="font-semibold text-safe hover:underline" href={REQUEST_CITY_URL} target="_blank" rel="noreferrer">
              Request it →
            </a>
          </p>
          <p className="mt-2.5 text-[11.5px] text-faint [&_b]:text-muted-foreground">
            Roads from <b>Overture Maps</b>. Cameras crowdsourced via{" "}
            <b>DeFlock / OpenStreetMap</b> — a known-incomplete lower bound.
          </p>
        </footer>
      </div>
    </div>
  );
}
