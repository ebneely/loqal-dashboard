import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post, patch } };
});

const { ApiError } = await import("@/lib/api");
const { PromoCodesScreen } = await import("../promo-codes-screen");
const {
  ADMIN_PROMO_PATH,
  EMPTY_PROMO_FORM,
  SHOP_PROMO_PATH,
  parsePromoList,
  promoProblems,
  toPromoBody,
} = await import("../promo-codes-data");

const p = en.brand.promo;

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (path: string = SHOP_PROMO_PATH) =>
  render(
    <LocaleProvider locale="en">
      <PromoCodesScreen
        path={path}
        note={p.shopNote}
        requiredRole="BRAND_OWNER"
        deniedTitle={p.deniedTitle}
        deniedBody={p.deniedBody}
      />
    </LocaleProvider>
  );

const row = {
  id: "promo-1",
  code: "EID10",
  kind: "PERCENT",
  value: "10",
  maxDiscount: "50.00",
  minSubtotal: null,
  startsAt: null,
  endsAt: null,
  usageLimit: 100,
  perCustomerLimit: 1,
  active: true,
  redemptionCount: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  post.mockImplementation(() => answer({}));
  patch.mockImplementation(() => answer({}));
});

describe("promo form rules", () => {
  const form = (over: Partial<typeof EMPTY_PROMO_FORM>) => ({
    ...EMPTY_PROMO_FORM,
    code: "SAVE10",
    value: "10",
    ...over,
  });

  it("accepts a plain percentage code", () => {
    expect(promoProblems(form({}))).toEqual({});
  });

  it("checks the code: 3–20 of A–Z, 0–9 and hyphen, case-insensitive", () => {
    expect(promoProblems(form({ code: "" })).code).toBe("required");
    expect(promoProblems(form({ code: "AB" })).code).toBe("code");
    expect(promoProblems(form({ code: "A".repeat(21) })).code).toBe("code");
    expect(promoProblems(form({ code: "EID 10" })).code).toBe("code");
    expect(promoProblems(form({ code: "خصم" })).code).toBe("code");
    expect(promoProblems(form({ code: "eid-10" })).code).toBeUndefined();
  });

  it("keeps a percentage between 1 and 90, whole", () => {
    expect(promoProblems(form({ value: "0" })).value).toBe("percent");
    expect(promoProblems(form({ value: "91" })).value).toBe("percent");
    expect(promoProblems(form({ value: "12.5" })).value).toBe("percent");
    expect(promoProblems(form({ value: "90" })).value).toBeUndefined();
    expect(promoProblems(form({ value: "" })).value).toBe("required");
  });

  it("wants a fixed amount above zero, in pounds", () => {
    expect(promoProblems(form({ kind: "FIXED", value: "0" })).value).toBe("positive");
    expect(promoProblems(form({ kind: "FIXED", value: "abc" })).value).toBe("money");
    expect(promoProblems(form({ kind: "FIXED", value: "150.5" })).value).toBeUndefined();
  });

  it("checks the cap only on a percentage", () => {
    expect(promoProblems(form({ maxDiscount: "x" })).maxDiscount).toBe("money");
    expect(promoProblems(form({ kind: "FIXED", value: "20", maxDiscount: "x" })).maxDiscount)
      .toBeUndefined();
  });

  it("wants limits of 1 or more and an end after the start", () => {
    expect(promoProblems(form({ usageLimit: "0" })).usageLimit).toBe("count");
    expect(promoProblems(form({ perCustomerLimit: "1.5" })).perCustomerLimit).toBe("count");
    expect(promoProblems(form({ usageLimit: "1", perCustomerLimit: "1" }))).toEqual({});
    expect(
      promoProblems(form({ startsAt: "2026-12-01T10:00", endsAt: "2026-12-01T10:00" })).endsAt
    ).toBe("endBeforeStart");
    expect(
      promoProblems(form({ startsAt: "2026-12-01T10:00", endsAt: "2026-12-02T10:00" })).endsAt
    ).toBeUndefined();
  });
});

describe("the write body", () => {
  const filled = {
    ...EMPTY_PROMO_FORM,
    code: " eid10 ",
    value: "10",
    maxDiscount: "50",
    usageLimit: "100",
  };

  it("upper-cases the code and leaves unset fields out of a create", () => {
    expect(toPromoBody(filled, "create")).toEqual({
      code: "EID10",
      kind: "PERCENT",
      value: "10",
      maxDiscount: "50",
      usageLimit: 100,
      active: true,
    });
  });

  it("sends cleared fields as null on an edit, and no cap on a fixed amount", () => {
    const body = toPromoBody({ ...filled, kind: "FIXED", value: "25" }, "edit");
    expect(body).toMatchObject({ maxDiscount: null, minSubtotal: null, endsAt: null, value: "25" });
  });
});

describe("reading the list defensively", () => {
  it("takes a bare array or an items page and drops rows it cannot read", () => {
    expect(parsePromoList([row])).toHaveLength(1);
    expect(parsePromoList({ items: [row, { id: "x" }], nextCursor: null })).toHaveLength(1);
    expect(parsePromoList(null)).toEqual([]);
  });

  it("defaults the optional fields and reads a number as a decimal", () => {
    const [parsed] = parsePromoList([{ id: "a", code: "X1Y", kind: "FIXED", value: 25 }]);
    expect(parsed).toMatchObject({
      value: "25",
      maxDiscount: null,
      usageLimit: null,
      active: true,
      redemptionCount: null,
    });
  });
});

describe("promo codes screen", () => {
  it("says 'not available yet' and draws no form when the API answers 404", async () => {
    get.mockImplementation(() => answer(new ApiError(404, "Cannot GET", "NotFound")));
    renderScreen();

    expect(await screen.findByText(p.unavailableTitle)).toBeTruthy();
    expect(screen.queryByLabelText(p.code)).toBeNull();
    expect(screen.queryByText(p.errorTitle)).toBeNull();
  });

  it("lists codes with their usage count", async () => {
    get.mockImplementation(() => answer([row]));
    renderScreen();

    expect((await screen.findAllByText("EID10")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("7 of 100").length).toBeGreaterThan(0);
  });

  it("creates a code on the path it was given", async () => {
    get.mockImplementation(() => answer([]));
    renderScreen(ADMIN_PROMO_PATH);
    await screen.findByText(p.emptyTitle);

    fireEvent.change(screen.getByLabelText(p.code), { target: { value: "ramadan" } });
    fireEvent.change(screen.getByLabelText(p.valuePercent), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: p.create }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(expect.anything(), ADMIN_PROMO_PATH, {
        code: "RAMADAN",
        kind: "PERCENT",
        value: "15",
        active: true,
      })
    );
    expect(await screen.findByText(p.created)).toBeTruthy();
  });

  it("names a bad value under its field and keeps Save off", async () => {
    get.mockImplementation(() => answer([]));
    renderScreen();
    await screen.findByText(p.emptyTitle);

    fireEvent.change(screen.getByLabelText(p.code), { target: { value: "OK1" } });
    fireEvent.change(screen.getByLabelText(p.valuePercent), { target: { value: "95" } });

    expect(screen.getByText(p.problem.percent)).toBeTruthy();
    expect(screen.getByRole("button", { name: p.create }).hasAttribute("disabled")).toBe(true);
  });

  it("deactivates with a PATCH of active only", async () => {
    get.mockImplementation(() => answer([row]));
    renderScreen();

    const [button] = await screen.findAllByRole("button", { name: `${p.deactivate}: EID10` });
    fireEvent.click(button);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(expect.anything(), `${SHOP_PROMO_PATH}/promo-1`, {
        active: false,
      })
    );
  });
});
