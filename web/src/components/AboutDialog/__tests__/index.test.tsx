import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AboutDialog from "@/components/AboutDialog";

describe("AboutDialog", () => {
  it("is closed until the trigger is clicked", () => {
    render(<AboutDialog />);
    expect(screen.getByRole("button", { name: /privacy & terms/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens and states the privacy posture + the key disclaimers", async () => {
    render(<AboutDialog />);
    await userEvent.click(screen.getByRole("button", { name: /privacy & terms/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/entirely in your browser/i)).toBeInTheDocument();
    expect(screen.getByText(/no tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/do not use it to facilitate/i)).toBeInTheDocument();
    expect(screen.getByText(/accept no liability/i)).toBeInTheDocument();
    expect(screen.getByText(/crowdsourced and incomplete/i)).toBeInTheDocument();
  });

  it("closes on the X button", async () => {
    render(<AboutDialog />);
    await userEvent.click(screen.getByRole("button", { name: /privacy & terms/i }));
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
