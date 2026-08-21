import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CityCard from "@/components/CityCard";
import type { CityIndexEntry } from "@/lib/types";

const CITY: CityIndexEntry = {
  slug: "atlanta-ga",
  city: "Atlanta",
  state: "GA",
  center: [-84.388, 33.749],
  zoom: 11.8,
  counts: { alpr: 1217, cameras: 1394, flock: 1111 },
};

const wrap = (c: CityIndexEntry) =>
  render(
    <MemoryRouter>
      <CityCard city={c} />
    </MemoryRouter>,
  );

describe("CityCard", () => {
  it("shows the city, state and counts", () => {
    wrap(CITY);
    expect(screen.getByText("Atlanta")).toBeInTheDocument();
    expect(screen.getByText("GA")).toBeInTheDocument();
    expect(screen.getByText("1,217")).toBeInTheDocument(); // ALPR, localized
  });

  it("links to the city's route page", () => {
    wrap(CITY);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/atlanta-ga");
  });
});
