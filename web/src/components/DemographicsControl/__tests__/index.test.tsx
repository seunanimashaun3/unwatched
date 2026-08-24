import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DemographicsControl from "@/components/DemographicsControl";
import { OVERLAYS, type OverlayVar } from "@/lib/demographics";

const ALL: OverlayVar[] = ["income", "povertyRate", "homeValue", "density"];

describe("DemographicsControl", () => {
  it("renders nothing when the city has no demographic layers", () => {
    const { container } = render(<DemographicsControl options={[]} overlay={null} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is collapsed by default and opens to list None + every available layer", async () => {
    render(<DemographicsControl options={ALL} overlay={null} onChange={vi.fn()} />);
    // collapsed: chips not shown yet
    expect(screen.queryByRole("button", { name: "None" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /demographics/i }));
    expect(screen.getByRole("button", { name: "None" })).toBeInTheDocument();
    for (const v of ALL) {
      expect(screen.getByRole("button", { name: OVERLAYS[v].label })).toBeInTheDocument();
    }
  });

  it("calls onChange with the chosen layer, and null for None", async () => {
    const onChange = vi.fn();
    render(<DemographicsControl options={ALL} overlay="income" onChange={onChange} />);
    // toggle shows the active layer name
    await userEvent.click(screen.getByRole("button", { name: new RegExp(OVERLAYS.income.label, "i") }));
    await userEvent.click(screen.getByRole("button", { name: OVERLAYS.homeValue.label }));
    expect(onChange).toHaveBeenLastCalledWith("homeValue");
    await userEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("shows the active layer's legend + honesty caveat when open", async () => {
    render(<DemographicsControl options={ALL} overlay="income" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(OVERLAYS.income.label, "i") }));
    expect(screen.getByText(OVERLAYS.income.legend[0].label)).toBeInTheDocument(); // e.g. "$30k"
    expect(screen.getByText(/context, not a claim/i)).toBeInTheDocument();
  });
});
