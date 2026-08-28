import { useEffect, useState } from "react";
import type { CityIndexEntry, PendingPoint } from "@/lib/types";
import { fetchCitiesIndex } from "@/lib/cities";
import { clearLastCity, loadLastCity, saveLastCity, validCity } from "@/lib/lastCity";
import City from "@/pages/City";
import Overview from "@/pages/Overview";
import LoadingScreen from "@/components/LoadingScreen";

/**
 * Single-page map app. Loads the supported-city index and lands on the
 * Overview (a national map of every supported city). Picking a city — by pin,
 * or by a global search that resolves into a covered city — enters that city's
 * planner. Switching cities is in-app state; there are no per-city routes.
 */
export default function App() {
  const [cities, setCities] = useState<CityIndexEntry[] | null>(null);
  const [refreshed, setRefreshed] = useState<string | undefined>();
  // restore the last city so a refresh / return trip stays put
  const [slug, setSlug] = useState<string>(() => loadLastCity());
  const [pending, setPending] = useState<PendingPoint | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchCitiesIndex()
      .then((d) => {
        setCities(d.cities);
        setRefreshed(d.refreshed);
        setSlug((s) => validCity(s, d.cities)); // drop a stale/removed persisted city
      })
      .catch(() => setError(true));
  }, []);

  const enterCity = (s: string, p?: PendingPoint) => {
    setPending(p ?? null);
    setSlug(s);
    saveLastCity(s);
  };
  const exitToOverview = () => {
    setPending(null);
    setSlug("");
    clearLastCity(); // "back to all cities" resets to the Overview on next visit
  };

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-background">
        <div className="text-center">
          <h1 className="mb-1.5 text-3xl font-bold tracking-tight">Unwatched</h1>
          <p className="text-sm text-muted-foreground">Couldn't load the city list.</p>
        </div>
      </div>
    );
  }

  if (!cities) return <LoadingScreen label="Loading…" />;

  if (!slug) return <Overview cities={cities} refreshed={refreshed} onEnter={enterCity} />;

  // key on slug so the whole map experience resets cleanly when switching cities
  return (
    <City
      key={slug}
      slug={slug}
      cities={cities}
      pending={pending}
      onCityChange={enterCity}
      onExit={exitToOverview}
    />
  );
}
