import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Sparkline } from "../sparkline";

const WEEK = [
  { label: "Mon", value: 4 },
  { label: "Tue", value: 9 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 11 },
];

describe("Sparkline", () => {
  it("draws the window as one filled shape", () => {
    const { container } = render(
      <Sparkline data={WEEK} label="Orders over the last 7 days" />
    );

    expect(container.querySelector(".recharts-surface")).not.toBeNull();
    expect(container.querySelector(".recharts-area")).not.toBeNull();
  });

  it("says what it is a picture of", () => {
    // Inside a KPI tile it sits under a bare number. Without a name it is an
    // unexplained squiggle to a screen reader and to everyone else.
    render(<Sparkline data={WEEK} label="Orders over the last 7 days" />);

    expect(
      screen.getByRole("img", { name: "Orders over the last 7 days" })
    ).toBeInTheDocument();
  });

  it("takes its colour from the chart token, so dark mode follows", () => {
    const { container } = render(
      <Sparkline data={WEEK} label="Orders over the last 7 days" />
    );

    expect(container.querySelector("style")?.textContent).toContain(
      "var(--chart-1)"
    );
  });

  it("draws nothing at all from a single point", () => {
    // One point is not a trend. A one-pixel dash under a KPI is a decoration
    // that looks like information.
    const { container } = render(
      <Sparkline data={[{ label: "Mon", value: 4 }]} label="Orders" />
    );

    expect(container.querySelector(".recharts-surface")).toBeNull();
  });

  it("draws nothing from no points", () => {
    const { container } = render(<Sparkline data={[]} label="Orders" />);

    expect(container.innerHTML).toBe("");
  });

  it("still draws a window that never left zero", () => {
    // A flat line at zero is the answer, not the absence of one.
    const { container } = render(
      <Sparkline
        data={[
          { label: "Mon", value: 0 },
          { label: "Tue", value: 0 },
        ]}
        label="Orders"
      />
    );

    expect(container.querySelector(".recharts-area")).not.toBeNull();
  });
});
