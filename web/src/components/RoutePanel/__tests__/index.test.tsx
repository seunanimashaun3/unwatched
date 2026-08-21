import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoutePanel from "@/components/RoutePanel";

const PRESETS = [
  { label: "Mission → Marina", a: [-122.42, 37.76] as [number, number], b: [-122.44, 37.8] as [number, number] },
  { label: "Downtown → Sunset", a: [-122.4, 37.79] as [number, number], b: [-122.49, 37.75] as [number, number] },
];

function setup(overrides: Partial<React.ComponentProps<typeof RoutePanel>> = {}) {
  const props: React.ComponentProps<typeof RoutePanel> = {
    start: null,
    end: null,
    startLabel: null,
    endLabel: null,
    arm: "a",
    setArm: vi.fn(),
    bbox: [-122.52, 37.7, -122.35, 37.83],
    presets: PRESETS,
    onSelect: vi.fn(),
    onClear: vi.fn(),
    penaltyS: 90,
    setPenaltyS: vi.fn(),
    alprOnly: true,
    setAlprOnly: vi.fn(),
    routing: false,
    result: null,
    applyPreset: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
  render(<RoutePanel {...props} />);
  return props;
}

describe("RoutePanel", () => {
  it("shows presets only before any endpoint is chosen", () => {
    setup();
    expect(screen.getByText("Mission → Marina")).toBeInTheDocument();
  });

  it("hides presets once a start is set", () => {
    setup({ start: [-122.42, 37.77], startLabel: "1 Main St" });
    expect(screen.queryByText("Mission → Marina")).not.toBeInTheDocument();
  });

  it("applies a preset when clicked", async () => {
    const props = setup();
    await userEvent.click(screen.getByText("Downtown → Sunset"));
    expect(props.applyPreset).toHaveBeenCalledOnce();
  });

  it("arms the destination when its search box is focused", async () => {
    const props = setup();
    await userEvent.click(screen.getByLabelText("Destination"));
    expect(props.setArm).toHaveBeenCalledWith("b");
  });

  it("shows the endpoint's label once set", () => {
    setup({ start: [-122.42, 37.77], startLabel: "Ferry Building" });
    expect(screen.getByDisplayValue("Ferry Building")).toBeInTheDocument();
  });

  it("moves the detour slider", async () => {
    const props = setup({ penaltyS: 90 });
    const slider = screen.getByRole("slider");
    slider.focus();
    await userEvent.keyboard("{ArrowRight}"); // +1 step (15) → 105
    expect(props.setPenaltyS).toHaveBeenCalledWith(105);
  });

  it("toggles the ALPR-only checkbox", async () => {
    const props = setup();
    await userEvent.click(screen.getByLabelText(/only avoid license-plate readers/i));
    expect(props.setAlprOnly).toHaveBeenCalledWith(false);
  });

  it("shows a spinner label while routing", () => {
    setup({ start: [-122.42, 37.77], end: [-122.43, 37.78], routing: true });
    expect(screen.getByText(/finding the least-watched route/i)).toBeInTheDocument();
  });

  it("surfaces a routing error", () => {
    setup({
      start: [-122.42, 37.77],
      end: [-122.43, 37.78],
      result: { ok: false, reason: "No driving route found between those points." },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/no driving route/i);
  });

  it("offers a Clear button once an endpoint exists", async () => {
    const props = setup({ start: [-122.42, 37.77], startLabel: "1 Main St" });
    await userEvent.click(screen.getByText("Clear route"));
    expect(props.reset).toHaveBeenCalledOnce();
  });
});
