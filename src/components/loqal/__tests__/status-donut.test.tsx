import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatusDonut } from "../status-donut";

const STATUSES = [
  { key: "DELIVERED", label: "Delivered", value: 42 },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", value: 11 },
  { key: "AWAITING_PAYMENT", label: "Awaiting payment", value: 6 },
  { key: "CANCELLED", label: "Cancelled", value: 3 },
];

describe("StatusDonut", () => {
  it("draws one sector per status", () => {
    const { container } = render(
      <StatusDonut
        data={STATUSES}
        label="Orders by status"
        emptyLabel="No orders in this window"
      />
    );

    expect(container.querySelector(".recharts-surface")).not.toBeNull();
    expect(container.querySelectorAll(".recharts-pie-sector")).toHaveLength(4);
  });

  it("prints the figure beside every slice, not only the colour", () => {
    // Four shades in a ring are four shades. The count is what somebody reads.
    render(
      <StatusDonut
        data={STATUSES}
        label="Orders by status"
        emptyLabel="No orders in this window"
      />
    );

    const rows = screen.getAllByRole("listitem");

    expect(rows.map((row) => row.textContent)).toEqual([
      "Delivered42",
      "Out for delivery11",
      "Awaiting payment6",
      "Cancelled3",
    ]);
  });

  it("takes every slice colour from a chart token", () => {
    const { container } = render(
      <StatusDonut
        data={STATUSES}
        label="Orders by status"
        emptyLabel="No orders in this window"
      />
    );

    const style = container.querySelector("style")?.textContent ?? "";

    expect(style).toContain("--color-DELIVERED: var(--chart-1)");
    expect(style).toContain("--color-CANCELLED: var(--chart-4)");
  });

  it("says what it is a picture of", () => {
    render(
      <StatusDonut
        data={STATUSES}
        label="Orders by status"
        emptyLabel="No orders in this window"
      />
    );

    expect(
      screen.getByRole("img", { name: "Orders by status" })
    ).toBeInTheDocument();
  });

  it("keeps a status with no orders out of the ring", () => {
    // A zero-width sector is invisible and its legend row claims a colour that
    // is nowhere on the chart.
    const { container } = render(
      <StatusDonut
        data={[...STATUSES, { key: "REFUNDED", label: "Refunded", value: 0 }]}
        label="Orders by status"
        emptyLabel="No orders in this window"
      />
    );

    expect(container.querySelectorAll(".recharts-pie-sector")).toHaveLength(4);
    expect(screen.queryByText("Refunded")).toBeNull();
  });

  it("says so, rather than drawing an empty ring, when nothing was ordered", () => {
    const { container } = render(
      <StatusDonut
        data={[{ key: "DELIVERED", label: "Delivered", value: 0 }]}
        label="Orders by status"
        emptyLabel="No orders in this window"
      />
    );

    expect(screen.getByText("No orders in this window")).toBeInTheDocument();
    expect(container.querySelector(".recharts-surface")).toBeNull();
  });
});
