import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExposurePanel from "@/components/ExposurePanel";

describe("ExposurePanel", () => {
  it("prompts the user to tap when there is no measurement yet", () => {
    render(<ExposurePanel exposure={null} />);
    expect(screen.getByText(/tap anywhere/i)).toBeInTheDocument();
  });

  it("shows the ALPR count as the headline score", () => {
    render(
      <ExposurePanel exposure={{ alpr: 7, total: 12, flock: 5, nearest: 45 }} />,
    );
    expect(screen.getByTestId("exposure-score").textContent).toBe("7");
  });

  it("renders the full breakdown", () => {
    render(
      <ExposurePanel exposure={{ alpr: 7, total: 12, flock: 5, nearest: 45 }} />,
    );
    expect(screen.getByText("License-plate readers (ALPR)")).toBeInTheDocument();
    expect(screen.getByText("All surveillance cameras")).toBeInTheDocument();
    expect(screen.getByText("45 m")).toBeInTheDocument(); // nearest formatted
  });

  it("shows a dash for nearest when there is no ALPR anywhere", () => {
    render(
      <ExposurePanel exposure={{ alpr: 0, total: 3, flock: 0, nearest: null }} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
