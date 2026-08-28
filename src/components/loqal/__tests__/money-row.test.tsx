import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MoneyRow } from "../money-row";

describe("MoneyRow", () => {
  it("says in words that a negative balance is owed to Loqal", () => {
    // A minus sign is a fact about a number. "You owe Loqal" is the sentence
    // the shop owner has to act on, and it is the one that must be readable at
    // a glance on a phone.
    render(<MoneyRow amount="-1240.00" />);

    expect(screen.getByText("You owe Loqal")).toBeInTheDocument();
    expect(screen.getByText("1,240.00")).toBeInTheDocument();
  });

  it("says in words that a positive balance is owed to the brand", () => {
    render(<MoneyRow amount="1240.00" />);

    expect(screen.getByText("Loqal owes you")).toBeInTheDocument();
  });

  it("names the other party in the admin console's perspective", () => {
    render(<MoneyRow amount="-1240.00" perspective="platform" />);

    expect(screen.getByText("This brand owes Loqal")).toBeInTheDocument();
  });

  it("treats zero as settled rather than as money owed", () => {
    render(<MoneyRow amount="0.00" />);

    expect(screen.getByText("Nothing owed either way")).toBeInTheDocument();
  });

  it("names the party in Arabic too", () => {
    render(<MoneyRow amount="-500.00" locale="ar" />);

    expect(screen.getByText("أنت مستحق عليك لـلوكال")).toBeInTheDocument();
  });

  it("formats without rounding a string that a float would lose", () => {
    render(<MoneyRow amount="-12345678.99" />);

    expect(screen.getByText("12,345,678.99")).toBeInTheDocument();
  });

  it("still names the party for a screen reader when rendered inline", () => {
    render(<MoneyRow amount="-40.50" variant="inline" />);

    expect(
      screen.getByLabelText("You owe Loqal: −40.50 EGP")
    ).toBeInTheDocument();
  });

  it("prints no placeholder glyph in front of a settled inline figure", () => {
    // The inline variant strips the sign box's background, so `sign || "0"`
    // put a bare leading zero in front of the amount: "0 0.00 EGP".
    const { container } = render(<MoneyRow amount="0.00" variant="inline" />);

    expect(container.querySelector(".lq-money-sign")).toBeNull();
    expect(screen.getByText("0.00")).toBeInTheDocument();
  });

  it("keeps the boxed placeholder in the hero figure, where it is a box", () => {
    const { container } = render(<MoneyRow amount="0.00" />);

    expect(container.querySelector(".lq-money-sign")?.textContent).toBe("0");
  });

  it("still prints a real sign inline, because that one is the fact", () => {
    const { container } = render(<MoneyRow amount="-40.50" variant="inline" />);

    expect(container.querySelector(".lq-money-sign")?.textContent).toBe("−");
  });

  it("marks the direction on the element so a row can tint itself", () => {
    const { container } = render(<MoneyRow amount="12.00" />);

    expect(
      container.querySelector('[data-direction="LOQAL_OWES_BRAND"]')
    ).not.toBeNull();
  });
});
