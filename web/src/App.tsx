import { useEffect, useState } from "react";
import type { CityIndexEntry } from "@/lib/types";
import { fetchCitiesIndex } from "@/lib/cities";
import City from "@/pages/City";
import LoadingScreen from "@/components/LoadingScreen";

const STORE_KEY = "city";

/**
 * Single-page map app. Loads the supported-city index, remembers the last
 * chosen city, and renders that city's map. Switching cities is in-app state
 * (via the CitySwitcher) — there are no per-city routes.
 */
export default function App() {
  const [cities, setCities] = useState<CityIndexEntry[] | null>(null);
  const [slug, setSlug] = useState<string>(() => {
    try {
      return localStorage.getItem(STORE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchCitiesIndex()
      .then((d) => {
        setCities(d.cities);
        setSlug((s) => (s && d.cities.some((c) => c.slug === s) ? s : (d.cities[0]?.slug ?? "")));
      })
      .catch(() => setError(true));
  }, []);

  const changeCity = (s: string) => {
    setSlug(s);
    try {
      localStorage.setItem(STORE_KEY, s);
    } catch {
      /* storage may be unavailable */
    }
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

  if (!cities || !slug) return <LoadingScreen label="Loading…" />;

  // key on slug so the whole map experience resets cleanly when switching cities
  return <City key={slug} slug={slug} cities={cities} onCityChange={changeCity} />;
}
