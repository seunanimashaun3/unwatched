import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommuteExposure from "@/components/CommuteExposure";
import { shareExposure } from "@/lib/shareCard";
import type { Camera, RouteResult } from "@/lib/types";

vi.mock("@/lib/shareCard", () => ({ shareExposure: vi.fn(() => Promise.resolve()) }));

// [lon, lat, isAlpr, isFlock, operator]
const cams: Camera[] = [
  [-84.4, 33.7, 1, 0, "APD"],
  [-84.4, 33.7, 1, 0, "APD"],
  [-84.3, 33.8, 1, 0, "Fulton PD"],
];

const route = (alprCameras: number[]): RouteResult => ({
  path: [],
  distanceM: 0,
  timeS: 0,
  cameras: alprCameras,
  alprCameras,
});

describe("CommuteExposure", () => {
  it("projects the yearly logged count, per-trip, and distinct agencies", () => {
    render(<CommuteExposure route={route([0, 1, 2])} cameras={cams} city="Atlanta" />);
    expect(screen.getByText("1,500×")).toBeInTheDocument(); // 3 × 2 × 250
    expect(screen.getByText(/logged per year/i)).toBeInTheDocument();
    expect(screen.getByText("3×")).toBeInTheDocument(); // per trip
    expect(screen.getByText(/2 agencies/i)).toBeInTheDocument(); // APD + Fulton PD, deduped
    expect(screen.getByText(/APD · Fulton PD/)).toBeInTheDocument();
  });

  it("shows a positive, camera-free message and no share when nothing logs you", () => {
    render(<CommuteExposure route={route([])} cameras={cams} city="Atlanta" />);
    expect(screen.getByText(/every mapped plate reader/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
  });

  it("shares the exposure card on tap", async () => {
    render(<CommuteExposure route={route([0, 1, 2])} cameras={cams} city="Atlanta" />);
    await userEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(shareExposure).toHaveBeenCalledWith(
      expect.objectContaining({ perYear: 1500, perTrip: 3, agencies: 2, city: "Atlanta" }),
    );
  });
});
