import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Home from "@/pages/Home";
import type { CityIndexEntry } from "@/lib/types";

const CITIES: CityIndexEntry[] = [
  { slug: "san-francisco-ca", city: "San Francisco", state: "CA", center: [-122.4, 37.7], zoom: 12, counts: { alpr: 526, cameras: 1907, flock: 483 } },
  { slug: "atlanta-ga", city: "Atlanta", state: "GA", center: [-84.3, 33.7], zoom: 12, counts: { alpr: 385, cameras: 394, flock: 311 } },
];

vi.mock("@/lib/cities", () => ({
  fetchCitiesIndex: vi.fn(async () => ({ cities: CITIES })),
  REQUEST_CITY_URL: "https://example.com/request",
}));

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe("Home", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every supported city", async () => {
    renderHome();
    expect(await screen.findByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText("Atlanta")).toBeInTheDocument();
  });

  it("filters the list as you search", async () => {
    renderHome();
    await screen.findByText("San Francisco");
    await userEvent.type(screen.getByLabelText("Search cities"), "atl");
    await waitFor(() => expect(screen.queryByText("San Francisco")).not.toBeInTheDocument());
    expect(screen.getByText("Atlanta")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    renderHome();
    await screen.findByText("San Francisco");
    await userEvent.type(screen.getByLabelText("Search cities"), "zzzz");
    expect(await screen.findByText(/No supported city matches/)).toBeInTheDocument();
  });

  it("offers a request-a-city link", async () => {
    renderHome();
    await screen.findByText("San Francisco");
    expect(screen.getByText(/Request it/)).toHaveAttribute("href", "https://example.com/request");
  });
});
