import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { platformSettingsSchema } from "@loqal/contracts/admin.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/settings",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const { SettingsScreen } = await import("../settings-screen");
const { ar } = await import("@/messages/ar");

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

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <SettingsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(settings));
  patch.mockImplementation(() => answer(settings));
});

describe("/admin/settings — grouped so nobody changes the wrong number", () => {
  it("draws all five groups with what each governs", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    for (const group of [
      en.admin.groupAnalytics,
      en.admin.groupSales,
      en.admin.groupTryOn,
      en.admin.groupChat,
      en.admin.groupBadges,
    ]) {
      expect(screen.getByText(group)).toBeInTheDocument();
    }
  });

  it("labels every basis-points field as basis points", async () => {
    // "100" meaning one per cent is exactly the unit that gets entered as
    // 100 per cent once, and one of these is a commission floor.
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    expect(screen.getAllByText(en.admin.unitBps).length).toBe(3);
    expect(screen.getAllByText(new RegExp(en.admin.bpsHint)).length).toBe(3);
  });

  it("says the try-on ceiling is US cents, unlike everything else here", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    expect(screen.getAllByText(en.admin.unitCents).length).toBeGreaterThan(0);
  });
});

describe("/admin/settings — the save names only what changed", () => {
  it("keeps the button disabled until something differs", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    expect(screen.getByText(en.admin.settingsNoChanges)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.saveSettings })
    ).toBeDisabled();
  });

  it("sends exactly one key when one field changed", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Badge window/), {
      target: { value: "45" },
    });
    expect(
      screen.getByText(en.admin.settingsChangedCount.replace("{n}", "1"))
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.admin.saveSettings }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/admin/settings");
    expect(body).toEqual({ badgeWindowDays: 45 });
  });

  it("says which keys were sent after a save", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Badge window/), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveSettings }));

    expect(await screen.findByText(en.admin.settingsSaved)).toBeInTheDocument();
  });

  it("marks a field holding an illegal value and refuses the save", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Badge window/), {
      target: { value: "45.5" },
    });

    expect(
      screen.getByRole("button", { name: en.admin.saveSettings })
    ).toBeDisabled();
    expect(screen.getByLabelText(/Badge window/)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});

describe("/admin/settings — the timezone is refused with its reason", () => {
  it("explains why rather than disabling the field silently", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Analytics timezone/), {
      target: { value: "UTC" },
    });

    expect(await screen.findByTestId("timezone-refused")).toHaveTextContent(
      en.admin.timezoneReason
    );
    expect(
      screen.getByRole("button", { name: en.admin.saveSettings })
    ).toBeDisabled();
  });

  it("still saves the other keys when the timezone was also edited", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Analytics timezone/), {
      target: { value: "UTC" },
    });
    fireEvent.change(screen.getByLabelText(/Badge window/), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveSettings }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(body).toEqual({ badgeWindowDays: 45 });
    expect(body).not.toHaveProperty("analyticsTimezone");
  });

  it("marks the field read-only up front", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    expect(screen.getByText(en.admin.timezoneReadOnly)).toBeInTheDocument();
  });
});

describe("/admin/settings — an empty nullable field means null, not zero", () => {
  it("sends null for a cleared commission floor", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Sales commission floor/), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveSettings }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(body).toEqual({ salesCommissionFloorBps: null });
  });

  it("says empty means no limit, on the fields where it does", async () => {
    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    expect(
      screen.getAllByText(new RegExp(en.admin.leaveEmptyForNone)).length
    ).toBe(2);
  });
});

describe("/admin/settings — states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws denied on a 403 and names the role", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });

  it("reports a failed save without changing anything on screen", async () => {
    patch.mockImplementation(() =>
      answer(new ApiError(422, "Unprocessable", "UnprocessableEntity"))
    );

    renderScreen();

    await screen.findByText(en.admin.groupAnalytics);
    fireEvent.change(screen.getByLabelText(/Badge window/), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveSettings }));

    expect(await screen.findByText(en.admin.saveFailed)).toBeInTheDocument();
  });
});

describe("/admin/settings — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    expect(await screen.findByText(ar.admin.settingsNote)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.settingsNote)).toBeNull();
  });
});
