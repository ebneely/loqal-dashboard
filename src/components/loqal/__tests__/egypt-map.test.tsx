import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { EgyptMap } from "../egypt-map";

const shapeOf = (container: HTMLElement, code: string) =>
  container.querySelector(`[data-governorate="${code}"]`);

/**
 * Six governorates with orders and one explicitly at zero. The spread is the
 * real one — Cairo dwarfs everything — because that is the distribution the
 * bucketing has to survive.
 */
const ORDERS = [
  { code: "CAI", label: "Cairo", value: 120 },
  { code: "GIZ", label: "Giza", value: 64 },
  { code: "ALX", label: "Alexandria", value: 31 },
  { code: "DAK", label: "Dakahlia", value: 12 },
  { code: "ASN", label: "Aswan", value: 5 },
  { code: "LUX", label: "Luxor", value: 1 },
  { code: "WAD", label: "New Valley", value: 0 },
];

describe("EgyptMap", () => {
  it("draws the whole country, not only the places with data", () => {
    // A choropleth missing its uncoloured regions is not a map of Egypt; it is
    // a scatter of blobs nobody can locate.
    const { container } = render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(container.querySelectorAll("svg path")).toHaveLength(27);
  });

  it("names every shape, its figure and what the figure counts", () => {
    // The only text a screen reader — or anyone who cannot separate five
    // shades of one hue — ever gets out of a choropleth.
    render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(
      screen.getByRole("img", { name: "Cairo: 120 orders" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "New Valley: 0 orders" })
    ).toBeInTheDocument();
  });

  it("names a governorate the caller sent no row for at all", () => {
    render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(
      screen.getByRole("img", { name: "Port Said: 0 orders" })
    ).toBeInTheDocument();
  });

  it("carries the caller's detail into the shape's name", () => {
    render(
      <EgyptMap
        data={[
          { code: "CAI", label: "Cairo", value: 120, detail: "4,300.00 EGP" },
        ]}
        emptyLabel="No orders yet"
        valueLabel="orders"
      />
    );

    expect(
      screen.getByRole("img", {
        name: "Cairo: 120 orders · 4,300.00 EGP",
      })
    ).toBeInTheDocument();
  });

  it("fills a governorate with orders from the scale and one without from muted", () => {
    const { container } = render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(shapeOf(container, "CAI")).toHaveAttribute("fill", "var(--chart-1)");
    expect(shapeOf(container, "WAD")).toHaveAttribute("fill", "var(--muted)");
    expect(shapeOf(container, "PTS")).toHaveAttribute("fill", "var(--muted)");
  });

  it("keeps zero out of the scale rather than giving it the palest bucket", () => {
    // Zero is not a small amount of something. It has to read as nothing.
    const { container } = render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(shapeOf(container, "WAD")).toHaveAttribute("data-bucket", "none");
    expect(shapeOf(container, "LUX")).toHaveAttribute("data-bucket", "0");
  });

  it("buckets by quantile, so one Cairo does not flatten the other 26", () => {
    // On a linear ramp 1, 5, 12 and 31 against a maximum of 120 are four
    // indistinguishable near-white shapes. By rank they are four steps.
    const { container } = render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(shapeOf(container, "LUX")).toHaveAttribute("data-bucket", "0");
    expect(shapeOf(container, "ASN")).toHaveAttribute("data-bucket", "1");
    expect(shapeOf(container, "DAK")).toHaveAttribute("data-bucket", "2");
    expect(shapeOf(container, "ALX")).toHaveAttribute("data-bucket", "3");
    expect(shapeOf(container, "CAI")).toHaveAttribute("data-bucket", "4");
  });

  it("gives the only governorate with data the strongest shade, not the palest", () => {
    const { container } = render(
      <EgyptMap
        data={[{ code: "CAI", label: "Cairo", value: 3 }]}
        emptyLabel="No orders yet"
        valueLabel="orders"
      />
    );

    expect(shapeOf(container, "CAI")).toHaveAttribute("data-bucket", "4");
  });

  it("ranks the top five beside the map, largest first", () => {
    // 27 shapes cannot be compared by eye. The list is where the number is
    // actually read.
    render(
      <EgyptMap data={ORDERS} emptyLabel="No orders yet" valueLabel="orders" />
    );

    const ranked = screen.getAllByRole("listitem");

    expect(ranked).toHaveLength(5);
    expect(ranked.map((item) => item.textContent)).toEqual([
      "Cairo120",
      "Giza64",
      "Alexandria31",
      "Dakahlia12",
      "Aswan5",
    ]);
  });

  it("groups a four-figure count with Latin digits", () => {
    render(
      <EgyptMap
        data={[{ code: "CAI", label: "Cairo", value: 12400 }]}
        emptyLabel="No orders yet"
        valueLabel="orders"
      />
    );

    expect(
      screen.getByRole("img", { name: "Cairo: 12,400 orders" })
    ).toBeInTheDocument();
  });

  it("keeps a governorate at zero out of the ranked list", () => {
    render(
      <EgyptMap
        data={[
          { code: "CAI", label: "Cairo", value: 2 },
          { code: "WAD", label: "New Valley", value: 0 },
        ]}
        emptyLabel="No orders yet"
        valueLabel="orders"
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("draws the country and says so when nothing has been ordered anywhere", () => {
    // Not an empty box: the reader has to see that the question was asked and
    // the answer was nothing.
    const { container } = render(
      <EgyptMap
        data={[{ code: "CAI", label: "Cairo", value: 0 }]}
        emptyLabel="No orders yet"
        valueLabel="orders"
      />
    );

    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    expect(container.querySelectorAll("svg path")).toHaveLength(27);
    expect(container.querySelector('[fill="var(--chart-1)"]')).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("says so for an empty payload too, rather than drawing nothing", () => {
    const { container } = render(
      <EgyptMap data={[]} emptyLabel="No orders yet" valueLabel="orders" />
    );

    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    expect(container.querySelectorAll("svg path")).toHaveLength(27);
  });
});
