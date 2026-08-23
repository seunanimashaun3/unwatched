import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Panel from "@/components/Panel";
import type { Meta } from "@/lib/types";

const META: Meta = {
  slug: "san-francisco-ca",
  city: "San Francisco",
  state: "CA",
  center: [-122.4194, 37.7649],
  zoom: 12.4,
  bbox: [-122.52, 37.7, -122.35, 37.83],
  presets: [],
  overtureRelease: "2026-07-22.0",
  cameraSource: "DeFlock / OpenStreetMap",
  counts: { nodes: 45482, edges: 54842, cameras: 1907, alpr: 526, flock: 483, watchedEdges: 5626 },
};

describe("Panel", () => {
  it("renders the brand and the active mode's tagline", () => {
    render(
      <Panel mode="route" onMode={vi.fn()} meta={META}>
        <div>body</div>
      </Panel>,
    );
    expect(screen.getByRole("heading", { name: "Unwatched" })).toBeInTheDocument();
    expect(screen.getByText(/steers around license-plate cameras/i)).toBeInTheDocument();
  });

  it("marks the current mode tab as selected", () => {
    render(
      <Panel mode="exposure" onMode={vi.fn()} meta={META}>
        <div />
      </Panel>,
    );
    expect(screen.getByRole("tab", { name: "Exposure score" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches mode when the other tab is clicked", async () => {
    const onMode = vi.fn();
    render(
      <Panel mode="route" onMode={onMode} meta={META}>
        <div />
      </Panel>,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Exposure score" }));
    expect(onMode).toHaveBeenCalledWith("exposure");
  });

  it("surfaces the data provenance and the incompleteness caveat", () => {
    render(
      <Panel mode="route" onMode={vi.fn()} meta={META}>
        <div />
      </Panel>,
    );
    expect(screen.getByText(/known-incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/Overture Maps/i)).toBeInTheDocument();
  });
});
