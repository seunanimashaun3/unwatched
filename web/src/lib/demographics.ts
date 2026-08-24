import { dataUrl } from "./dataBase";

export type OverlayVar = "income" | "povertyRate" | "homeValue" | "density" | "redlining";

type FC = GeoJSON.FeatureCollection & { meta?: { vintage?: string; retrieved?: string } };

/** Census-tract polygons + ACS attributes; null if the city has none yet. */
export async function fetchDemographics(slug: string): Promise<FC | null> {
  try {
    const r = await fetch(dataUrl(`${slug}/demographics.json`));
    return r.ok ? ((await r.json()) as FC) : null;
  } catch {
    return null;
  }
}

/** 1930s HOLC redlining areas (still extracted; not surfaced in the UI yet). */
export async function fetchRedlining(slug: string): Promise<FC | null> {
  try {
    const r = await fetch(dataUrl(`${slug}/redlining.json`));
    return r.ok ? ((await r.json()) as FC) : null;
  } catch {
    return null;
  }
}

/**
 * Which overlays a city has data for. Redlining is intentionally NOT offered
 * yet (still extracted, just hidden); only the ACS layers are surfaced.
 */
export function availableOverlays(tracts: FC | null): OverlayVar[] {
  if (tracts?.features.some((f) => f.properties?.income != null))
    return ["income", "povertyRate", "homeValue", "density"];
  return [];
}

export const NO_DATA = "#6b7280";

export interface LegendStop {
  color: string;
  label: string;
}

export interface VarMeta {
  label: string;
  legend: LegendStop[];
  source: string; // short citation
  href: string; // link to the source table
}

// Legend colors MUST match the map paint ramps in mapLayers.ts (a test guards it).
export const OVERLAYS: Record<OverlayVar, VarMeta> = {
  income: {
    label: "Median income",
    source: "ACS 5-year 2020–2024 · B19013",
    href: "https://data.census.gov/table/ACSDT5Y2024.B19013",
    legend: [
      { color: "#440154", label: "$30k" },
      { color: "#3b528b", label: "$60k" },
      { color: "#21918c", label: "$90k" },
      { color: "#5ec962", label: "$120k" },
      { color: "#fde725", label: "$160k+" },
    ],
  },
  povertyRate: {
    label: "Poverty rate",
    source: "ACS 5-year 2020–2024 · B17001",
    href: "https://data.census.gov/table/ACSDT5Y2024.B17001",
    legend: [
      { color: "#fff5eb", label: "0%" },
      { color: "#fdae6b", label: "10%" },
      { color: "#f16913", label: "20%" },
      { color: "#a63603", label: "35%+" },
    ],
  },
  homeValue: {
    label: "Home value",
    source: "ACS 5-year 2020–2024 · B25077",
    href: "https://data.census.gov/table/ACSDT5Y2024.B25077",
    legend: [
      { color: "#edf8fb", label: "$100k" },
      { color: "#b2e2e2", label: "$300k" },
      { color: "#66c2a4", label: "$500k" },
      { color: "#2ca25f", label: "$800k" },
      { color: "#006d2c", label: "$1.2M+" },
    ],
  },
  density: {
    label: "Density",
    source: "ACS B01003 ÷ Census land area",
    href: "https://data.census.gov/table/ACSDT5Y2024.B01003",
    legend: [
      { color: "#f2f0f7", label: "0" },
      { color: "#cbc9e2", label: "3k" },
      { color: "#9e9ac8", label: "8k" },
      { color: "#756bb1", label: "15k" },
      { color: "#54278f", label: "25k+/mi²" },
    ],
  },
  redlining: {
    label: "1930s redlining",
    source: "HOLC via Mapping Inequality (1935–40)",
    href: "https://dsl.richmond.edu/panorama/redlining/",
    legend: [
      { color: "#5aa469", label: '"Best" (A)' },
      { color: "#5b8fc4", label: '"Still desirable" (B)' },
      { color: "#e2c044", label: '"Declining" (C)' },
      { color: "#d1495b", label: '"Hazardous" (D)' },
    ],
  },
};
