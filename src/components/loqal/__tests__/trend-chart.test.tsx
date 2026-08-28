import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TrendChart } from "../trend-chart";

const WINDOW = [
  { label: "01 Aug", value: 12 },
  { label: "02 Aug", value: 0 },
  { label: "03 Aug", value: 31 },
];

describe("TrendChart", () => {
  it("draws the series as a filled area over a grid", () => {
    const { container } = render(
      <TrendChart
        data={WINDOW}
        seriesLabel="Orders"
        label="Orders per day"
        emptyLabel="No orders in this window"
      />
    );

    expect(container.querySelector(".recharts-surface")).not.toBeNull();
    expect(container.querySelector(".recharts-area")).not.toBeNull();
    expect(container.querySelector(".recharts-cartesian-grid")).not.toBeNull();
  });

  it("labels the days along the axis", () => {
    const { container } = render(
      <TrendChart
        data={WINDOW}
        seriesLabel="Orders"
        label="Orders per day"
        emptyLabel="No orders in this window"
      />
    );

    const ticks = Array.from(
      container.querySelectorAll(".recharts-cartesian-axis-tick-value")
    ).map((tick) => tick.textContent);

    expect(ticks).toContain("01 Aug");
    expect(ticks).toContain("03 Aug");
  });

  it("says what it is a picture of", () => {
    render(
      <TrendChart
        data={WINDOW}
        seriesLabel="Orders"
        label="Orders per day"
        emptyLabel="No orders in this window"
      />
    );

    expect(
      screen.getByRole("img", { name: "Orders per day" })
    ).toBeInTheDocument();
  });

  it("takes its colour from the chart token, so dark mode follows", () => {
    const { container } = render(
      <TrendChart
        data={WINDOW}
        seriesLabel="Orders"
        label="Orders per day"
        emptyLabel="No orders in this window"
      />
    );

    expect(container.querySelector("style")?.textContent).toContain(
      "--color-value: var(--chart-1)"
    );
  });

  it("draws a window that stayed at zero rather than calling it empty", () => {
    // Three days of no trade IS the reading. Replacing it with "no data" says
    // the question was not asked.
    const { container } = render(
      <TrendChart
        data={[
          { label: "01 Aug", value: 0 },
          { label: "02 Aug", value: 0 },
        ]}
        seriesLabel="Orders"
        label="Orders per day"
        emptyLabel="No orders in this window"
      />
    );

    expect(container.querySelector(".recharts-area")).not.toBeNull();
    expect(screen.queryByText("No orders in this window")).toBeNull();
  });

  it("says so when there is no window at all", () => {
    const { container } = render(
      <TrendChart
        data={[]}
        seriesLabel="Orders"
        label="Orders per day"
        emptyLabel="No orders in this window"
      />
    );

    expect(screen.getByText("No orders in this window")).toBeInTheDocument();
    expect(container.querySelector(".recharts-surface")).toBeNull();
  });
});
