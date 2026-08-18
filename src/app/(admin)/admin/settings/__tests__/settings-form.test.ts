/**
 * The grouped-read / flat-write asymmetry, and the two values that are null
 * rather than zero.
 */
import { describe, expect, it } from "vitest";

import { platformSettingsSchema } from "@loqal/contracts/admin.contract";

import { diffSettings, formFrom, timezoneIsRefused } from "../settings-form";

const settings = platformSettingsSchema.parse({
  id: 1,
  updatedAt: "2026-08-01T00:00:00.000Z",
  analytics: {
    analyticsTimezone: "Africa/Cairo",
    analyticsKAnonymityFloor: 3,
    ingestRejectRetentionDays: 30,
  },
  sales: {
    defaultFreeMonths: 3,
    salesCommissionFloorBps: 1200,
    salesMaxFreeMonths: 6,
  },
  tryOn: {
    tryOnModelId: "fal-ai/fashn/tryon/v1.6",
    tryOnFallbackModelId: "fal-ai/image-apps-v2/virtual-try-on",
    tryOnMonthlyBudgetCents: 50000,
    tryOnAccountLifetimeCap: 20,
  },
  chat: {
    chatAttachmentMaxBytes: 5242880,
    chatAttachmentAllowedMimeTypes: ["image/jpeg", "application/pdf"],
    guestThreadLifetimeDays: 30,
    chatUnansweredThresholdMinutes: 120,
  },
  badges: {
    badgeMinOrderCount: 20,
    badgeWindowDays: 30,
    badgeSameDayShareBpsThreshold: 8000,
    badgeFastConfirmMinutesThreshold: 60,
    badgeCancellationRateBpsMax: 500,
  },
});

const unbounded = platformSettingsSchema.parse({
  ...settings,
  sales: {
    ...settings.sales,
    salesCommissionFloorBps: null,
    salesMaxFreeMonths: null,
  },
});

describe("formFrom — the grouped read flattens to one editable row", () => {
  it("carries every key from all five groups", () => {
    const form = formFrom(settings);
    expect(Object.keys(form)).toHaveLength(19);
    expect(form.analyticsTimezone).toBe("Africa/Cairo");
    expect(form.badgeCancellationRateBpsMax).toBe("500");
  });

  it("renders a null floor as EMPTY, never as zero", () => {
    // Null means no floor has been fixed yet; 0 means a floor of nothing. A
    // sales rep is held to one of those and not the other.
    const form = formFrom(unbounded);
    expect(form.salesCommissionFloorBps).toBe("");
    expect(form.salesMaxFreeMonths).toBe("");
  });

  it("joins the mime list into one editable line", () => {
    expect(formFrom(settings).chatAttachmentAllowedMimeTypes).toBe(
      "image/jpeg, application/pdf"
    );
  });
});

describe("diffSettings — the save names only what changed", () => {
  it("sends nothing when nothing was touched", () => {
    const diff = diffSettings(settings, formFrom(settings));
    expect(diff.changed).toEqual([]);
    expect(diff.body).toBeNull();
  });

  it("sends exactly one key when one field changed", () => {
    const form = { ...formFrom(settings), badgeWindowDays: "45" };
    const diff = diffSettings(settings, form);
    expect(diff.changed).toEqual(["badgeWindowDays"]);
    expect(diff.body).toEqual({ badgeWindowDays: 45 });
  });

  it("leaves an untouched key out of the body entirely", () => {
    // This is what lets somebody else's concurrent change survive this save
    // rather than being overwritten with whatever this screen loaded with.
    const form = { ...formFrom(settings), badgeWindowDays: "45" };
    const body = diffSettings(settings, form).body;
    expect(body).not.toHaveProperty("badgeMinOrderCount");
    expect(body).not.toHaveProperty("analyticsKAnonymityFloor");
  });

  it("clears a nullable field to null, never to zero", () => {
    const form = { ...formFrom(settings), salesCommissionFloorBps: "" };
    expect(diffSettings(settings, form).body).toEqual({
      salesCommissionFloorBps: null,
    });
  });

  it("splits the mime list back into an array, dropping empties", () => {
    const form = {
      ...formFrom(settings),
      chatAttachmentAllowedMimeTypes: "image/png ,, image/webp ",
    };
    expect(diffSettings(settings, form).body).toEqual({
      chatAttachmentAllowedMimeTypes: ["image/png", "image/webp"],
    });
  });

  it("refuses an empty mime list rather than sending one", () => {
    const form = { ...formFrom(settings), chatAttachmentAllowedMimeTypes: " , " };
    const diff = diffSettings(settings, form);
    expect(diff.body).toBeNull();
    expect(diff.invalid).toContain("chatAttachmentAllowedMimeTypes");
  });

  it("refuses a number field holding something that is not a whole number", () => {
    for (const bad of ["12.5", "-3", "twenty", " ", "1e3"]) {
      const form = { ...formFrom(settings), badgeWindowDays: bad };
      const diff = diffSettings(settings, form);
      expect(diff.body, `"${bad}" was accepted`).toBeNull();
      expect(diff.invalid).toContain("badgeWindowDays");
    }
  });

  it("refuses a value the contract's own bounds reject, before the request", () => {
    // 20000 bps is 200%. The API answers 400; this answers with a field.
    const form = { ...formFrom(settings), badgeCancellationRateBpsMax: "20000" };
    const diff = diffSettings(settings, form);
    expect(diff.body).toBeNull();
    expect(diff.invalid).toContain("badgeCancellationRateBpsMax");
  });

  it("refuses a k-anonymity floor of zero, which would switch off the withholding", () => {
    const form = { ...formFrom(settings), analyticsKAnonymityFloor: "0" };
    expect(diffSettings(settings, form).body).toBeNull();
  });
});

describe("diffSettings — the timezone is a legal key and an illegal change", () => {
  it("reports the edit and refuses to send it", () => {
    // Day boundaries are baked into every analytics row at ingest, so a change
    // would not recompute anything — it would make one table mean two things.
    const form = { ...formFrom(settings), analyticsTimezone: "UTC" };
    const diff = diffSettings(settings, form);

    expect(diff.changed).toContain("analyticsTimezone");
    expect(timezoneIsRefused(diff)).toBe(true);
    expect(diff.body).toBeNull();
  });

  it("does not block the other keys when the timezone was also edited", () => {
    const form = {
      ...formFrom(settings),
      analyticsTimezone: "UTC",
      badgeWindowDays: "45",
    };
    const diff = diffSettings(settings, form);

    expect(timezoneIsRefused(diff)).toBe(true);
    expect(diff.body).toEqual({ badgeWindowDays: 45 });
    expect(diff.body).not.toHaveProperty("analyticsTimezone");
  });

  it("says nothing about the timezone when it was left alone", () => {
    const diff = diffSettings(settings, formFrom(settings));
    expect(timezoneIsRefused(diff)).toBe(false);
  });
});
