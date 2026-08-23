import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBox from "@/components/SearchBox";
import type { LngLat } from "@/lib/types";

const NEAR: LngLat = [-122.43, 37.77];

function baseProps(overrides = {}) {
  return {
    kind: "a" as const,
    label: "Start",
    valueLabel: null as string | null,
    armed: false,
    near: NEAR,
    onArm: vi.fn(),
    onSelect: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
}

function mockPhoton(features: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ features }) })));
}

afterEach(() => vi.unstubAllGlobals());

describe("SearchBox", () => {
  it("shows the label as placeholder and the value when set", () => {
    const { rerender } = render(<SearchBox {...baseProps()} />);
    expect(screen.getByPlaceholderText("Start")).toBeInTheDocument();
    rerender(<SearchBox {...baseProps({ valueLabel: "Ferry Building" })} />);
    expect(screen.getByDisplayValue("Ferry Building")).toBeInTheDocument();
  });

  it("arms the endpoint on focus", async () => {
    const p = baseProps();
    render(<SearchBox {...p} />);
    await userEvent.click(screen.getByLabelText("Start"));
    expect(p.onArm).toHaveBeenCalled();
  });

  it("clears the endpoint via the clear button", async () => {
    const p = baseProps({ valueLabel: "Somewhere" });
    render(<SearchBox {...p} />);
    await userEvent.click(screen.getByLabelText("Clear Start"));
    expect(p.onClear).toHaveBeenCalled();
  });

  it("searches as you type and selects a result", async () => {
    mockPhoton([
      {
        geometry: { type: "Point", coordinates: [-122.42, 37.77] },
        properties: { name: "Ferry Building", city: "San Francisco" },
      },
    ]);
    const p = baseProps();
    render(<SearchBox {...p} />);
    const input = screen.getByLabelText("Start");
    await userEvent.click(input);
    await userEvent.type(input, "ferry");
    const option = await screen.findByText(/Ferry Building/);
    await userEvent.click(option);
    await waitFor(() =>
      expect(p.onSelect).toHaveBeenCalledWith([-122.42, 37.77], expect.stringMatching(/Ferry Building/)),
    );
  });
});
