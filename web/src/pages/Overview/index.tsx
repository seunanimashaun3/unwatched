import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import type { CityIndexEntry, PendingPoint } from "@/lib/types";
import { buildMapStyle } from "@/lib/mapStyle";
import { geocode, type GeoResult } from "@/lib/geocode";
import { cityForPoint } from "@/lib/proximity";
import { REQUEST_CITY_URL } from "@/lib/cities";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useTheme } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import AboutDialog from "@/components/AboutDialog";
import MapCredit from "@/components/MapCredit";

/**
 * Landing map: no forced city. The whole country of supported cities is shown
 * as pins so you can see coverage at a glance and tap in — or search any
 * address and jump straight into the city that covers it.
 */
export default function Overview({
  cities,
  onEnter,
}: {
  cities: CityIndexEntry[];
  onEnter: (slug: string, pending?: PendingPoint) => void;
}) {
  const { theme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const mapObj = useRef<maplibregl.Map | null>(null);
  const enterRef = useRef(onEnter);
  enterRef.current = onEnter;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [notCovered, setNotCovered] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const geo = useGeolocation();

  // jump to my location: enter its city if covered, else say it's not
  const locate = () => {
    setGeoMsg(null);
    setNotCovered(null);
    setLocating(true);
    geo
      .locateOnce()
      .then((f) => {
        const c = cityForPoint(f.point, cities);
        if (!c) {
          setGeoMsg("No cameras mapped near you yet.");
          return;
        }
        const m = mapObj.current;
        if (m) {
          // end at the city's own center/zoom so the hand-off is seamless
          m.flyTo({ center: c.center as [number, number], zoom: c.zoom, duration: 1900, essential: true });
          window.setTimeout(() => enterRef.current(c.slug), 1750);
        } else {
          enterRef.current(c.slug);
        }
      })
      .catch(() => setGeoMsg("Couldn't get your location."))
      .finally(() => setLocating(false));
  };

  // ---- the map: fit to every supported city, drop a labelled pin on each ----
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: buildMapStyle(theme),
      center: [-97, 39],
      zoom: 3.2,
      attributionControl: false,
      dragRotate: false,
    });
    mapObj.current = map;

    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds();
      cities.forEach((c) => {
        bounds.extend(c.center as [number, number]);
        const el = document.createElement("button");
        el.className = "city-pin";
        el.type = "button";
        el.innerHTML =
          `<span class="city-pin-dot"></span>` +
          `<span class="city-pin-label">${c.city}<b>${c.counts.alpr.toLocaleString()} cams</b></span>`;
        // smooth zoom into the city — end exactly where the City view opens
        // (its center/zoom) so the hand-off doesn't jump
        el.addEventListener("click", () => {
          map.flyTo({ center: c.center as [number, number], zoom: c.zoom, duration: 1900, essential: true });
          window.setTimeout(() => enterRef.current(c.slug), 1750);
        });
        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(c.center as [number, number])
          .addTo(map);
      });
      if (cities.length) {
        map.fitBounds(bounds, { padding: 90, maxZoom: 9, duration: 0 });
      }
      map.resize(); // guard against a 0-size canvas on first paint
    });

    return () => {
      mapObj.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, cities]);

  // ---- global search: debounce, then geocode biased to the map center ----
  useEffect(() => {
    setNotCovered(null);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await geocode(query, [-97, 39], ctrl.signal);
      setResults(r);
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function choose(r: GeoResult) {
    const city = cityForPoint(r.point, cities);
    if (city) {
      onEnter(city.slug, { kind: "a", point: r.point, label: r.label });
    } else {
      setResults([]);
      setNotCovered(r.label);
    }
  }

  return (
    <div className="absolute inset-0">
      {/* the map is the hero — explicit full-viewport size so the canvas paints */}
      <div ref={container} className="fixed inset-0 h-screen w-screen" />
      <MapCredit />

      {/* subtle top scrim so the top chrome stays legible over the map */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-24 bg-gradient-to-b from-background/70 to-transparent" />

      {/* brand + privacy link — top left (kept clear of the map attribution) */}
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
          <span className="live-dot" />
          <h1 className="font-display text-[17px] font-bold leading-none tracking-tight">Unwatched</h1>
        </div>
        <AboutDialog
          label="Private by design · Privacy & terms"
          className="rounded-md border border-border bg-card/85 px-2 py-1 text-[10.5px] text-faint shadow backdrop-blur-md hover:text-muted-foreground"
        />
      </div>

      {/* theme — top right */}
      <div className="absolute right-3 top-3 z-10">
        <ThemeToggle />
      </div>

      {/* locate — bottom-right FAB, clear of the top search */}
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        aria-label="Find my location"
        className="absolute bottom-20 right-3 z-10 grid size-11 place-items-center rounded-full border border-border bg-card/95 text-muted-foreground shadow-xl backdrop-blur-md transition-colors hover:border-ring hover:text-primary disabled:opacity-60 sm:bottom-6"
      >
        {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
      </button>

      {/* search — top center, rectangular */}
      <div className="absolute left-1/2 top-16 z-10 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 sm:top-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any address to find your city…"
            className="h-11 w-full rounded-lg border border-border bg-card/95 pl-9 pr-9 text-[14px] shadow-xl outline-none backdrop-blur-md transition-colors focus:border-ring focus:ring-2 focus:ring-ring/40"
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-faint" />
          )}

          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-2xl">
              {results.map((r, i) => (
                <li
                  key={r.label + i}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2.5 text-[13.5px] hover:bg-accent"
                  onClick={() => choose(r)}
                >
                  <MapPin className="size-3.5 shrink-0 text-faint" />
                  <span className="truncate">{r.label}</span>
                </li>
              ))}
            </ul>
          )}

          {notCovered && (
            <p className="mt-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-[12.5px] leading-snug shadow-xl backdrop-blur-md">
              <b className="text-alert">Not covered yet.</b> “{notCovered}” isn’t in a supported city.
              {REQUEST_CITY_URL && (
                <>
                  {" "}
                  <a href={REQUEST_CITY_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    Request it
                  </a>
                  .
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* bottom: a "not covered near you" prompt after locate, else the hint.
          Lifted above the map attribution on mobile to avoid overlap. */}
      <div className="absolute bottom-9 left-1/2 z-10 flex max-w-[calc(100%-5.5rem)] -translate-x-1/2 flex-col items-center gap-1.5 sm:bottom-4 sm:max-w-[calc(100%-1.5rem)]">
        {geoMsg ? (
          <div className="rounded-lg border border-border bg-card/95 px-4 py-2.5 text-center text-[12.5px] shadow-xl backdrop-blur-md">
            <b className="text-alert">{geoMsg}</b>
            {REQUEST_CITY_URL && (
              <>
                {" "}
                <a href={REQUEST_CITY_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  Request your city
                </a>
                .
              </>
            )}
          </div>
        ) : (
          <div className="pointer-events-none whitespace-nowrap rounded-full border border-border bg-card/90 px-4 py-2 text-center text-[12.5px] shadow-lg backdrop-blur-md">
            Tap a city to plan a route
            {/* the counts are nice on desktop but crowd the mobile bottom bar */}
            <span className="hidden sm:inline">
              <span className="mx-1.5 text-faint">·</span>
              <span className="text-muted-foreground">
                {cities.length} cities, {cities.reduce((n, c) => n + c.counts.alpr, 0).toLocaleString()} cameras mapped
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
