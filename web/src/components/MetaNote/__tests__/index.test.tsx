import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MetaNote, { fmtRefreshed } from "@/components/MetaNote";
import type { Meta } from "@/lib/types";

const meta = (extra: Partial<Meta> = {}): Meta =>
  ({
    slug: "nashville-tn",
    city: "Nashville",
    state: "TN",
    center: [0, 0],
    zoom: 10,
    bbox: [0, 0, 0, 0],
    presets: [],
    overtureRelease: "2026-07-22.0",
    cameraSource: "DeFlock / OpenStreetMap",
    counts: { nodes: 1, edges: 1, cameras: 297, alpr: 278, flock: 257, watchedEdges: 1 },
    ...extra,
  }) as Meta;

describe("fmtRefreshed", () => {
  it("formats an ISO date (keeps the correct day, no TZ drift)", () => {
    const out = fmtRefreshed("2026-08-27");
    expect(out).not.toBe("2026-08-27"); // actually formatted
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/27/);
  });

  it("falls back to the raw string on bad input", () => {
    expect(fmtRefreshed("not-a-date")).toBe("not-a-date");
  });
});

describe("MetaNote", () => {
  it("shows the freshness line when refreshed is present", () => {
    render(<MetaNote meta={meta({ refreshed: "2026-08-27" })} />);
    expect(screen.getByText(/Camera data updated/)).toBeInTheDocument();
    expect(screen.getByText(/Camera data updated/).textContent).toMatch(/2026/);
  });

  it("omits the freshness line when refreshed is absent", () => {
    render(<MetaNote meta={meta()} />);
    expect(screen.queryByText(/Camera data updated/)).not.toBeInTheDocument();
  });
});
