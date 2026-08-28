import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Kpi } from "../layout";

describe("Kpi", () => {
  it("still draws a bare label, value and note", () => {
    // Nine call sites pass exactly these three and nothing else. The two new
    // props are additive or they are a breaking change wearing a disguise.
    const { container } = render(
      <Kpi label="Orders" value="128" note="Last 30 days" />
    );

    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(container.querySelector(".lq-kpi")).not.toBeNull();
  });

  it("puts a figure under the value when one is given", () => {
    const { container } = render(
      <Kpi label="Orders" value="128" chart={<svg data-testid="spark" />} />
    );

    const spark = screen.getByTestId("spark");
    const figure = screen.getByText("128");

    expect(spark).toBeInTheDocument();
    expect(container.querySelector(".lq-kpi-val")).toBe(figure);
    expect(
      figure.compareDocumentPosition(spark) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("draws nothing extra when there is no figure and no movement", () => {
    const { container } = render(<Kpi label="Orders" value="128" />);

    expect(container.querySelector("[data-direction]")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("colours a rise as good and a fall as bad when the caller says so", () => {
    const { container } = render(
      <Kpi
        label="Orders"
        value="128"
        delta={{ direction: "up", label: "+12% vs last month" }}
      />
    );

    const chip = container.querySelector('[data-direction="up"]');

    expect(chip).toHaveTextContent("+12% vs last month");
    expect(chip?.className).toContain("text-state-good-fg");
  });

  it("colours a fall as bad", () => {
    const { container } = render(
      <Kpi
        label="Orders"
        value="128"
        delta={{ direction: "down", label: "−12% vs last month" }}
      />
    );

    expect(
      container.querySelector('[data-direction="down"]')?.className
    ).toContain("text-state-bad-fg");
  });

  it("leaves an unchanged window uncoloured rather than calling it good", () => {
    const { container } = render(
      <Kpi
        label="Orders"
        value="128"
        delta={{ direction: "flat", label: "No change" }}
      />
    );

    expect(
      container.querySelector('[data-direction="flat"]')?.className
    ).toContain("text-muted-foreground");
  });

  it("takes the direction from the caller and never from the sign", () => {
    // A refund rate rising is bad, and a returns figure falling is good. The
    // component cannot know which figure it is holding, so it does not guess:
    // a "−12%" the caller calls a rise is drawn as a rise.
    const { container } = render(
      <Kpi
        label="Refunds"
        value="3.1%"
        delta={{ direction: "down", label: "+0.4pp vs last month" }}
      />
    );

    const chip = container.querySelector("[data-direction]");

    expect(chip).toHaveAttribute("data-direction", "down");
    expect(chip?.className).toContain("text-state-bad-fg");
  });

  it("shows the movement and the note together", () => {
    render(
      <Kpi
        label="Orders"
        value="128"
        delta={{ direction: "up", label: "+12%" }}
        note="Last 30 days"
      />
    );

    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });
});
