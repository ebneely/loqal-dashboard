import { describe, expect, it } from "vitest";

import {
  brandProfileWireSchema,
  inEgypt,
  updateBrandProfileWireSchema,
} from "../settings-wire";
import { ownerProfile } from "./fixtures";

describe("location on the wire", () => {
  it("reads a body with no `location` key as null — the API may not have it yet", () => {
    const body: Record<string, unknown> = { ...ownerProfile };
    delete body.location;

    expect(brandProfileWireSchema.parse(body).location).toBeNull();
  });

  it("reads a stored point as it is", () => {
    const location = { latitude: 31.2, longitude: 29.9 };
    expect(
      brandProfileWireSchema.parse({ ...ownerProfile, location }).location
    ).toEqual(location);
  });

  it("accepts a write of a point, or null to clear it", () => {
    expect(
      updateBrandProfileWireSchema.safeParse({
        location: { latitude: 30.0444, longitude: 31.2357 },
      }).success
    ).toBe(true);
    expect(
      updateBrandProfileWireSchema.safeParse({ location: null }).success
    ).toBe(true);
  });
});

describe("inEgypt — the server's box, checked before the write", () => {
  it.each([
    [30.0444, 31.2357], // Cairo
    [21.5, 24.5], // the corners are inside
    [32, 37],
  ])("keeps %s, %s", (latitude, longitude) => {
    expect(inEgypt({ latitude, longitude })).toBe(true);
  });

  it.each([
    [21.49, 31], // south of the border
    [32.01, 31], // in the sea
    [30, 24.49], // in Libya
    [30, 37.01], // in Saudi Arabia
    [51.5, -0.12], // London
  ])("refuses %s, %s", (latitude, longitude) => {
    expect(inEgypt({ latitude, longitude })).toBe(false);
    expect(
      updateBrandProfileWireSchema.safeParse({ location: { latitude, longitude } })
        .success
    ).toBe(false);
  });
});
