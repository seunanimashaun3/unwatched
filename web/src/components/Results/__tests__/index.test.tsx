import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Results from "@/components/Results";
import type { RouteResult } from "@/lib/types";

const route = (timeS: number, distM: number, cams: number[]): RouteResult => ({
  path: [
    [0, 0],
    [1, 1],
  ],
  distanceM: distM,
  timeS,
  cameras: cams,
  alprCameras: cams,
});

describe("Results", () => {
  it("renders both route cards with camera counts", () => {
    render(<Results fast={route(360, 3000, [1, 2, 3])} priv={route(600, 4000, [3])} />);
    const counts = screen.getAllByTestId("cam-count").map((n) => n.textContent);
    expect(counts).toEqual(["3", "1"]);
    expect(screen.getByText("Fastest route")).toBeInTheDocument();
    expect(screen.getByText("Least-watched route")).toBeInTheDocument();
  });

  it("shows a privacy-win verdict with cameras avoided", () => {
    render(<Results fast={route(360, 3000, [1, 2, 3])} priv={route(600, 4000, [3])} />);
    expect(screen.getByRole("status").textContent).toMatch(/avoids/i);
    expect(screen.getByRole("status").textContent).toMatch(/2 cameras/);
  });

  it("explains when the fastest route is already the least-watched", () => {
    render(<Results fast={route(360, 3000, [])} priv={route(360, 3000, [])} />);
    expect(screen.getByRole("status").textContent).toMatch(/already the least-watched/i);
  });

  it("colors a zero-camera count as safe", () => {
    render(<Results fast={route(360, 3000, [1])} priv={route(600, 4000, [])} />);
    const zero = screen.getAllByTestId("cam-count").find((n) => n.textContent === "0");
    expect(zero!.className).toMatch(/text-safe/);
  });

  it("lets you select which route's cameras are shown", async () => {
    const onSelectRoute = vi.fn();
    render(
      <Results
        fast={route(360, 3000, [1, 2, 3])}
        priv={route(600, 4000, [3])}
        selected="private"
        onSelectRoute={onSelectRoute}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Fastest route/i }));
    expect(onSelectRoute).toHaveBeenCalledWith("fast");
  });

  it("marks the selected route as showing its cameras", () => {
    render(
      <Results
        fast={route(360, 3000, [1])}
        priv={route(600, 4000, [])}
        selected="fast"
        onSelectRoute={vi.fn()}
      />,
    );
    // the selected (fastest) card carries the "cameras shown" marker
    const fastCard = screen.getByRole("button", { name: /Fastest route/i });
    expect(fastCard.textContent).toMatch(/cameras shown/i);
  });
});
