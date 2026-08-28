// @vitest-environment node
/**
 * The rules that decide what the commerce dashboard is allowed to draw.
 *
 * They are pure and they live beside the fetch, so they can be argued with
 * here rather than through a rendered tree.
 */
import { describe, expect, it } from "vitest";

import {
  DELTA_MIN_ORDERS,
  SPARKLINE_MIN_DAYS,
  adminCommerceDashboardSchema,
  commerceDashboardSchema,
  dayLabel,
  movement,
  nonZeroDays,
  toPiastres,
  windowStart,
} from "../commerce-data";

const window = {
  orders: 12,
  revenue: "4800.00",
  customers: 9,
  averageOrderValue: "400.00",
};

const payload = {
  range: { from: "2026-07-30", to: "2026-08-28" },
  totals: window,
  previous: { ...window, orders: 8, revenue: "3200.00" },
  trend: [{ day: "2026-08-28", orders: 2, revenue: "800.00" }],
  byStatus: [{ status: "DELIVERED", count: 9 }],
  byGovernorate: [{ code: "CAI", orders: 7, revenue: "2800.00" }],
  topProducts: [{ name: "Prayer mat", qty: 4, revenue: "800.00" }],
  unmapped: { orders: 0, revenue: "0.00" },
};

describe("the commerce payload, which no contract package describes yet", () => {
  it("accepts the shape the plan specifies", () => {
    expect(commerceDashboardSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts a null average order value, because 0/0 is not 0", () => {
    const empty = {
      ...payload,
      totals: { orders: 0, revenue: "0.00", customers: 0, averageOrderValue: null },
    };

    expect(commerceDashboardSchema.parse(empty).totals.averageOrderValue).toBeNull();
  });

  it("keeps every money field a string, and refuses a number", () => {
    // A JS number here is the precision bug the string representation exists
    // to prevent, and it would be wrong about what a shop is owed.
    const asNumber = { ...payload, totals: { ...window, revenue: 4800 } };

    expect(commerceDashboardSchema.safeParse(asNumber).success).toBe(false);
  });

  it("carries what could not be placed on the map, rather than hiding it", () => {
    // An order that vanishes between the map and the total is a number nobody
    // can reconcile, so the API reports it and so does the screen.
    expect(
      commerceDashboardSchema.parse({
        ...payload,
        unmapped: { orders: 3, revenue: "1200.00" },
      }).unmapped
    ).toEqual({ orders: 3, revenue: "1200.00" });
  });

  it("refuses a payload with no unmapped block at all", () => {
    const { unmapped: _dropped, ...without } = payload;

    expect(commerceDashboardSchema.safeParse(without).success).toBe(false);
  });

  it("refuses a top-level key nobody declared", () => {
    expect(
      commerceDashboardSchema.safeParse({ ...payload, gmv: "1.00" }).success
    ).toBe(false);
  });
});

/**
 * The admin route answers a second question — where the SHOPS are — and the
 * brand route must not. Two schemas rather than one with optional fields, so
 * a brand payload that grew them would be refused rather than drawn.
 */
describe("the two extra fields only an admin is sent", () => {
  const adminPayload = {
    ...payload,
    byBrandLocation: [
      { code: "CAI", brands: 2 },
      { code: "GIZ", brands: 1 },
    ],
    unplacedBrands: 1,
  };

  it("accepts the admin payload, which is the shared one plus two fields", () => {
    expect(adminCommerceDashboardSchema.safeParse(adminPayload).success).toBe(
      true
    );
  });

  it("refuses an admin payload with no unplacedBrands, because absent is not zero", () => {
    // Required, never optional. A shop with no governorate that is silently
    // omitted makes the map lie about how many shops exist.
    const { unplacedBrands: _dropped, ...without } = adminPayload;

    expect(adminCommerceDashboardSchema.safeParse(without).success).toBe(false);
  });

  it("counts shops as an integer and never as money", () => {
    expect(
      adminCommerceDashboardSchema.safeParse({
        ...adminPayload,
        byBrandLocation: [{ code: "CAI", brands: "2" }],
      }).success
    ).toBe(false);
  });

  it("refuses the shops series on the shared schema a brand owner reads", () => {
    // `.strict()` is what stops a brand's screen from ever drawing where the
    // other shops are, even if the API were to start sending it.
    expect(commerceDashboardSchema.safeParse(adminPayload).success).toBe(false);
  });
});

describe("the window is a Cairo calendar window, not a UTC one", () => {
  it("counts back from today in Africa/Cairo", () => {
    // 21:00 UTC on the 27th is already the 28th in Cairo. A browser doing
    // UTC date maths would report the window one day short for three hours
    // every evening.
    const at = new Date("2026-08-27T21:00:00Z");

    expect(windowStart(30, at)).toBe("2026-07-30");
    expect(windowStart(7, at)).toBe("2026-08-22");
    expect(windowStart(1, at)).toBe("2026-08-28");
  });

  it("writes the day label in Latin digits under Arabic", () => {
    expect(dayLabel("2026-08-01", "ar")).not.toMatch(/[٠-٩۰-۹]/);
    expect(dayLabel("2026-08-01", "en")).toMatch(/01/);
  });
});

describe("a sparkline has to earn its place", () => {
  const day = (orders: number, index: number) => ({
    day: `2026-08-${String(index + 1).padStart(2, "0")}`,
    orders,
    revenue: orders === 0 ? "0.00" : "100.00",
  });

  it("counts the days that actually traded", () => {
    expect(nonZeroDays([day(0, 0), day(3, 1), day(0, 2)])).toBe(1);
  });

  it("stays away below the minimum, because a flat line is furniture", () => {
    const six = Array.from({ length: 6 }, (_, i) => day(1, i));

    expect(SPARKLINE_MIN_DAYS).toBe(7);
    expect(nonZeroDays(six) >= SPARKLINE_MIN_DAYS).toBe(false);
  });

  it("draws once there is a shape to draw", () => {
    const seven = Array.from({ length: 7 }, (_, i) => day(1, i));

    expect(nonZeroDays(seven) >= SPARKLINE_MIN_DAYS).toBe(true);
  });
});

describe("a delta needs a baseline worth comparing to", () => {
  it("is suppressed under the minimum, because +300% off one order is useless", () => {
    expect(DELTA_MIN_ORDERS).toBe(5);
    expect(movement(400, 100, 4)).toBeNull();
  });

  it("reports the direction and the size once the baseline is real", () => {
    expect(movement(120, 100, 5)).toEqual({ direction: "up", percent: 20 });
    expect(movement(80, 100, 9)).toEqual({ direction: "down", percent: -20 });
    expect(movement(100, 100, 9)).toEqual({ direction: "flat", percent: 0 });
  });

  it("refuses to divide by an empty previous window", () => {
    // Five orders that all cancelled leave a real order count and no money.
    expect(movement(500, 0, 5)).toBeNull();
  });
});

describe("money is compared without ever becoming a float", () => {
  it("reads a wire amount as exact piastres", () => {
    expect(toPiastres("1240.55")).toBe(124055);
    expect(toPiastres("0.10")).toBe(10);
    expect(toPiastres("-40")).toBe(-4000);
  });
});
