# Unwatched

**Plan a drive that steers around license-plate cameras — and see exactly what avoiding them costs you.**

Automatic license-plate readers (ALPRs) from companies like [Flock Safety](https://www.aclu.org/campaigns-initiatives/get-the-flock-out) now blanket American cities, logging where you drive without a warrant. Maps of these cameras exist (see [DeFlock](https://deflock.me)) — but they're passive. **Unwatched turns that map into an action:** pick your city, give it a start and destination, and it computes both the *fastest* route and the *least-watched* route, then tells you the trade-off honestly:

> Fastest: 13 min, logged by **16 plate readers**.
> Least-watched: 16 min, logged by **0** — +3 minutes to disappear.

It also has an **Exposure Score** mode (tap anywhere to see how many cameras watch that spot within a 5-minute walk) and a **Drive mode** — a live "you are here" dot that follows your GPS and **beeps + vibrates when you approach a known plate reader** ("⚠️ Flock camera 150 m ahead"), with a running "logged N×" counter. It's not turn-by-turn navigation — it's a live surveillance heads-up for testing in the car. (Geolocation needs HTTPS, which Render provides.)

🔗 **Live:** **https://unwatched.onrender.com** — try [San Jose](https://unwatched.onrender.com/san-jose-ca) (700 mapped plate readers).

## Cities

The home page (`/`) lists supported cities; each opens its own map at `/<city-slug>` (e.g. `/san-jose-ca`). Coverage is chosen for well-mapped ALPR density:

| City | Slug | ALPR mapped |
|---|---|---|
| San Jose, CA | `san-jose-ca` | 700 |
| San Francisco, CA | `san-francisco-ca` | 526 |
| New York, NY | `new-york-ny` | 400 |
| Atlanta, GA | `atlanta-ga` | 385 |
| Chicago, IL | `chicago-il` | 316 |

Adding a city is one entry in `scripts/cities.py` + a pipeline run. (San Jose is fitting — it's the city the [ACLU/EFF are suing](https://www.aclu.org/cases) over warrantless ALPR surveillance.)

---

## Why I built this

The brief was open-ended, and "another places-density map" felt generic. Flock's ALPR network is one of the most consequential map-data stories of 2025–26 — AG lawsuits, ACLU/EFF suits, officers caught abusing it to track exes and protesters. The interesting move isn't to *rebuild* a camera map (DeFlock already nails that), but to build the thing that doesn't exist yet: a **router that acts on the camera layer**. That reframes surveillance data from "here's what's watching you" into "here's how to not be watched" — a small, concrete transfer of power back to the individual.

It also fits Overture's data perfectly: Overture deliberately **doesn't** carry surveillance cameras, but it does carry a superb, routable road network. The product is exactly the *combination* neither source can do alone.

## How it works

```
Overture road network ─┐
                       ├─► build routing graph ─► A* with a per-edge
DeFlock/OSM cameras ───┘     (offline, Python)     "camera penalty" (in-browser)
```

- **Roads → Overture Maps.** Each city's driving network (segments + connectors) is queried straight from Overture's cloud GeoParquet with DuckDB, split at every connector into a routable graph, then reduced to its **largest strongly-connected component** so every point can actually reach every other point.
- **Cameras → DeFlock via OpenStreetMap.** Surveillance cameras per city, pulled from the Overpass API and bucketed into ALPR vs. generic CCTV. Each is matched to the road edges it watches (within 30 m).
- **Routing → client-side A\*.** Two costs over the same graph: travel time alone (fastest), and travel time **+ a tunable penalty per camera** (least-watched). Runs in a Web Worker in ~15–50 ms; **no backend**.
- **Search → Photon geocoder.** Type an address for the start/destination; results are biased to the city bbox and the map flies there. Falls back gracefully (map-click still works) if the geocoder is unavailable.

## Key trade-offs & cuts

- **No server, on purpose.** Each city's graph is precomputed and shipped as a static asset (1–3.6 MB gzipped) and lazy-loaded per city; pathfinding runs in the browser. The deploy is a static site with **no cold starts** — it just works when you open it — at the cost of a one-time per-city load. A Render/FastAPI backend was the alternative; I judged instant-load reliability worth more.
- **The camera layer is a known-incomplete lower bound.** It's crowdsourced, so it *misses* cameras and may include stale ones. I surface this in the UI ("known cameras") rather than implying completeness — the honest framing matters for a civil-liberties tool. The routes still hold: avoiding *known* cameras never makes you more exposed.
- **Camera "sees" = within 30 m of the road,** ignoring facing direction. OSM direction data is sparse and error-prone; a radius is robust and conservative.
- **One-way streets are best-effort** (Overture's access restrictions are often null); where present I honor them. Speeds are class-based defaults, so times are estimates, not turn-by-turn ETAs.
- **City choice is coverage-driven.** Overture roads are global, but DeFlock's ALPR density is uneven. Los Angeles was cut — its cameras are spread across the metro, not downtown, so a small-bbox graph gave poor coverage for a large file. San Jose's bbox is the widest (700 ALPRs, but a ~3.6 MB graph) — a deliberate coverage-over-size call for the lawsuit city.

## Repo layout

```
scripts/
  cities.py             # registry: bbox / center / zoom / presets per city
  extract_cameras.py    # ALPR/surveillance from DeFlock/OSM (Overpass)  <city>
  extract_overture.py   # driving network + neighborhoods from Overture   <city>
  build_graph.py        # → routable graph + per-edge camera exposure      <city>
  build_index.py        # → cities.json home-page index
  run_all.sh            # rebuild every city end-to-end
  verify_routing.mjs    # headless check: least-watched route avoids cameras
web/                    # Vite + React + TS + MapLibre; client-side A*; React Router
  src/pages/Home        # city list + search + request-a-city
  src/pages/City        # the map experience for one city
tests/                  # pytest: pipeline helpers + data contract (all cities)
```

## Run it locally

```bash
# 1. (optional) regenerate the data from source
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./scripts/run_all.sh                      # all cities, or: ./scripts/run_all.sh san-jose-ca

# 2. run the app
cd web && npm install && npm run dev      # http://localhost:5173

# 3. verify routing against generated data
node scripts/verify_routing.mjs san-jose-ca
```

## Testing

**183 tests** cover every layer.

```bash
cd web && npm test                        # 85: logic, routing engine, components, hooks, pages
python -m pytest -q                        # 83: pipeline helpers + data contract (× every city)
```

- **Routing engine** — A\* correctness on a controlled graph (takes the camera at 0 penalty, detours when high, ALPR-only filtering, one-way streets, dedup) + SCC connectivity.
- **Integration** — the real engine on real generated data asserts the core guarantee: *the least-watched route never exposes you to more cameras than the fastest*, monotonic in detour tolerance.
- **Data contract** — for every shipped city: valid node/camera references, meta counts match, presets present, index complete.
- **Components, hooks, pages, geocoder** — Testing Library; the worker is dependency-injected so `useRouter` unit-tests without a real Worker; the geocoder is tested with a mocked Photon.

## Deploy

Static build → any static host, HTTPS required (for geolocation / Drive mode).

- **Render (recommended):** `render.yaml` is included — in Render, *New → Blueprint*, connect the repo. It builds `web/` and serves `web/dist` at the root domain over HTTPS, with a `/* → /index.html` rewrite so deep links like `/san-jose-ca` resolve client-side.
- **GitHub Pages:** `.github/workflows/deploy.yml` builds with `BASE_PATH=/unwatched/` and publishes `web/dist`; `404.html` mirrors `index.html` for deep links.

## Data & credits

- **Roads, boundaries:** [Overture Maps](https://overturemaps.org) release `2026-07-22.0` (ODbL / CDLA).
- **Camera locations:** [DeFlock](https://deflock.me) via [OpenStreetMap](https://openstreetmap.org) (ODbL) — crowdsourced, incomplete.
- **Geocoding:** [Photon](https://photon.komoot.io) (OpenStreetMap). **Basemap:** [CARTO](https://carto.com) dark tiles + OSM.

Camera data reflects volunteer reports and may be inaccurate or out of date. This tool is for privacy awareness, not a guarantee of anonymity.
