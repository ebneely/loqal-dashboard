import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { ResponsiveList, type ResponsiveListColumn } from "../responsive-list";

type Row = { id: string; orderNumber: string; total: string; status: string };

const rows: Row[] = [
  { id: "1", orderNumber: "LQ-1041", total: "540.00", status: "Check the shelf" },
  { id: "2", orderNumber: "LQ-1042", total: "120.50", status: "Delivered" },
];

const columns: ResponsiveListColumn<Row>[] = [
  { key: "orderNumber", header: "Order", cell: (r) => r.orderNumber, primary: true },
  { key: "status", header: "Status", cell: (r) => r.status, meta: true },
  { key: "total", header: "Total", cell: (r) => r.total, numeric: true },
];

const list = (props: Partial<Parameters<typeof ResponsiveList<Row>>[0]> = {}) =>
  render(
    <ResponsiveList
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      {...props}
    />
  );

describe("ResponsiveList", () => {
  it("renders the same dataset twice — cards below md, a table at md and up", () => {
    // One dataset, one column definition, two renderings. A column added for
    // the desktop table cannot go missing on the phone, because the phone reads
    // the same array.
    const { container } = list();

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(within(table as HTMLElement).getAllByText("LQ-1041")).toHaveLength(1);

    // Both renderings are in the DOM; the breakpoint decides which is visible.
    expect(screen.getAllByText("LQ-1041")).toHaveLength(2);
  });

  it("hides the card stack at md and the table below it, with utility classes only", () => {
    const { container } = list();

    expect(container.querySelector(".md\\:hidden")).not.toBeNull();
    expect(container.querySelector(".hidden.md\\:block")).not.toBeNull();
  });

  it("keeps a tableOnly column out of the card", () => {
    const { container } = list({
      columns: [
        ...columns,
        {
          key: "internal",
          header: "Ledger id",
          cell: () => "LDG-9",
          tableOnly: true,
        },
      ],
    });

    const table = container.querySelector("table") as HTMLElement;
    expect(within(table).getAllByText("LDG-9")).toHaveLength(2);
    expect(screen.getAllByText("LDG-9")).toHaveLength(2);
  });

  it("calls back with the row from either rendering", () => {
    const onRowClick = vi.fn();
    list({ onRowClick });

    fireEvent.click(screen.getAllByText("LQ-1042")[0]);

    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("lets a screen replace the card entirely", () => {
    list({ renderCard: (row) => <article>card:{row.orderNumber}</article> });

    expect(screen.getByText(/card:LQ-1041/)).toBeInTheDocument();
  });
});

describe("ResponsiveList getRowHref", () => {
  /**
   * The affordance the foundation's own guidance asked for and the component
   * could not express. A card that only navigates on click has no keyboard
   * target and no address a shop owner can copy to a driver — so every screen
   * hand-rolled a Link inside its primary cell. This makes the right thing the
   * default.
   */
  it("renders a real anchor in the CARD layout", () => {
    const { container } = list({ getRowHref: (row) => `/orders/${row.id}` });

    const cards = container.querySelector(".md\\:hidden") as HTMLElement;
    const anchor = within(cards).getByRole("link", { name: "LQ-1041" });

    expect(anchor).toHaveAttribute("href", "/orders/1");
  });

  it("renders a real anchor in the TABLE layout too", () => {
    const { container } = list({ getRowHref: (row) => `/orders/${row.id}` });

    const table = container.querySelector("table") as HTMLElement;
    const anchor = within(table).getByRole("link", { name: "LQ-1042" });

    expect(anchor).toHaveAttribute("href", "/orders/2");
  });

  it("gives every row exactly one keyboard target per rendering", () => {
    list({ getRowHref: (row) => `/orders/${row.id}` });

    // Two rows, two renderings. Not four anchors per row, and not zero.
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("falls back to plain text for a row that has no address", () => {
    // `returnListItemSchema` carries the order NUMBER and no brandOrderId, so
    // there is genuinely nothing to route to. Returning null must not produce
    // an anchor to nowhere.
    list({ getRowHref: (row) => (row.id === "1" ? `/orders/1` : null) });

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getAllByText("LQ-1042")).toHaveLength(2);
  });

  it("draws no anchor at all when the prop is absent", () => {
    list();

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("leaves onRowClick working for screens that already use it", () => {
    // Additive, not a replacement. Three screens ship onRowClick today.
    const onRowClick = vi.fn();
    list({ onRowClick });

    fireEvent.click(screen.getAllByText("LQ-1042")[0]);

    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});
