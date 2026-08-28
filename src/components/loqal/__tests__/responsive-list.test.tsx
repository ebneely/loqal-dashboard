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

  /**
   * The switch is a CONTAINER query, not a media query — a system-level rule
   * in the design system, because a 390px phone frame embedded in a desktop
   * page has to render cards. So there are no `md:` utilities left to assert:
   * `.lq-rl` sets `container-type: inline-size` and loqal-components.css
   * flips `.lq-rl-cards` / `.lq-rl-table` at a 768px CONTAINER width.
   */
  it("switches between the card stack and the table on a container query", () => {
    const { container } = list();

    expect(container.querySelector(".lq-rl")).not.toBeNull();
    expect(container.querySelector(".lq-rl-cards")).not.toBeNull();
    expect(container.querySelector(".lq-rl-table")).not.toBeNull();
    // Nothing in this component may read the VIEWPORT.
    expect(container.querySelector(".md\\:hidden")).toBeNull();
    expect(container.querySelector(".hidden.md\\:block")).toBeNull();
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

    const cards = container.querySelector(".lq-rl-cards") as HTMLElement;
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

/**
 * A COLUMN OF FIGURES IS ONE COLUMN, HEADER INCLUDED. Alignment that only
 * holds while a vendored shadcn primitive keeps a particular utility on it is
 * not alignment, so the column states it here, on both halves.
 */
const headed = (table: HTMLElement, label: string) =>
  [...table.querySelectorAll("th")].find(
    (head) => head.textContent === label
  ) as HTMLElement;

const bodyCells = (table: HTMLElement) => [
  ...(table.querySelectorAll("tbody tr:first-child td") as NodeListOf<HTMLElement>),
];

describe("ResponsiveList numeric columns", () => {
  it("aligns the header and its values the same way", () => {
    // `classList`, not `className.includes` — `data-num:text-end` on the
    // vendored primitive CONTAINS the string "text-end" while aligning
    // nothing the component itself decided.
    const { container } = list();
    const table = container.querySelector("table") as HTMLElement;

    expect(headed(table, "Total").classList.contains("text-end")).toBe(true);
    expect(bodyCells(table).at(-1)?.classList.contains("text-end")).toBe(true);
  });

  it("aligns to the inline end, so the column mirrors with the page", () => {
    // The console is bilingual. `text-right` would put an Arabic figure column
    // on the wrong side of its own header.
    const { container } = list();

    expect(container.querySelector(".text-right")).toBeNull();
    expect(container.querySelector(".text-left")).toBeNull();
  });

  it("leaves a non-numeric column alone at both ends", () => {
    const { container } = list();
    const table = container.querySelector("table") as HTMLElement;

    expect(headed(table, "Status").classList.contains("text-end")).toBe(false);
    expect(bodyCells(table)[1]?.classList.contains("text-end")).toBe(false);
  });

  it("does not call the HEADING a figure", () => {
    // `[data-num]` is the product's "this is a number" mark — it sets the mono
    // face and tabular figures. A column heading is a label; putting the mark
    // on the <th> set the caps header in Source Code Pro.
    const { container } = list();
    const table = container.querySelector("table") as HTMLElement;

    expect(headed(table, "Total")).not.toHaveAttribute("data-num");
    expect(table.querySelector("tbody td[data-num]")).not.toBeNull();
  });

  it("pushes a BLOCK-level value to the inline end too", () => {
    // The bug on /admin/brands: the BALANCE cell renders `MoneyRow`, a flex
    // block that fills the cell, and `text-align` cannot move a block.
    const { container } = list({
      columns: [
        columns[0],
        {
          key: "money",
          header: "Balance",
          cell: () => <div className="flex">−40.50 EGP</div>,
          numeric: true,
        },
      ],
    });

    const table = container.querySelector("table") as HTMLElement;
    const cell = bodyCells(table).at(-1) as HTMLElement;
    const box = cell.querySelector('[data-slot="numeric-value"]');

    expect(box).not.toBeNull();
    expect(box?.className).toContain("justify-end");
  });
});
