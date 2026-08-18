import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/try-on",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const { TryOnScreen } = await import("../try-on-screen");
const {
  ceilingIsZero,
  formFrom,
  formatUsd,
  tryOnDiff,
  tryOnSettingsSchema,
} = await import("../try-on-data");
const { ar } = await import("@/messages/ar");

const MODEL = "fal-ai/fashn/tryon/v1.6";
const FALLBACK = "fal-ai/image-apps-v2/virtual-try-on";

const models = [
  { id: MODEL, costMicros: 75000, costUsd: 0.075 },
  { id: FALLBACK, costMicros: 40000, costUsd: 0.04 },
];

const okSettings = tryOnSettingsSchema.parse({
  tryOnModelId: MODEL,
  tryOnFallbackModelId: FALLBACK,
  tryOnMonthlyBudgetCents: 50000,
  tryOnAccountLifetimeCap: 20,
  monthSpendUsd: 120.5,
  monthBudgetUsd: 500,
  percentUsed: 24,
  budgetState: "OK",
  activeModelId: MODEL,
  rendersThisMonth: { READY: 1600, FAILED: 12 },
});

const stoppedSettings = tryOnSettingsSchema.parse({
  ...okSettings,
  monthSpendUsd: 500,
  percentUsed: 100,
  budgetState: "STOPPED",
  activeModelId: null,
});

const zeroCeiling = tryOnSettingsSchema.parse({
  ...stoppedSettings,
  tryOnMonthlyBudgetCents: 0,
  monthBudgetUsd: 0,
  monthSpendUsd: 0,
  rendersThisMonth: {},
});

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const answerBoth = (settings: unknown) => {
  get.mockImplementation((_schema: unknown, path: string) =>
    path.endsWith("/models") ? answer(models) : answer(settings)
  );
};

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <TryOnScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  answerBoth(okSettings);
  patch.mockImplementation(() => answer({}));
});

describe("the try-on diff — a save names only what changed", () => {
  it("sends nothing when nothing was touched", () => {
    expect(tryOnDiff(okSettings, formFrom(okSettings))).toBeNull();
  });

  it("sends exactly the changed key", () => {
    expect(
      tryOnDiff(okSettings, {
        ...formFrom(okSettings),
        tryOnMonthlyBudgetCents: "60000",
      })
    ).toEqual({ tryOnMonthlyBudgetCents: 60000 });
  });

  it("refuses a number field that is not a whole number", () => {
    for (const bad of ["12.5", "-1", "", "lots"]) {
      expect(
        tryOnDiff(okSettings, {
          ...formFrom(okSettings),
          tryOnAccountLifetimeCap: bad,
        }),
        bad
      ).toBeNull();
    }
  });

  it("refuses a ceiling above the fat-finger guard", () => {
    expect(
      tryOnDiff(okSettings, {
        ...formFrom(okSettings),
        tryOnMonthlyBudgetCents: "10000001",
      })
    ).toBeNull();
  });
});

describe("US dollars, never EGP", () => {
  it("formats the provider's bill in dollars", () => {
    expect(formatUsd(120.5)).toBe("$120.50");
    expect(formatUsd(0.075)).toBe("$0.08");
  });
});

describe("/admin/try-on — the state is the server's, never recomputed", () => {
  it("carries the API's own budget state onto the gauge", async () => {
    const { container } = renderScreen();

    await screen.findByText(en.admin.budgetOk);
    expect(
      container.querySelector('[data-budget-state="OK"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-percent-used="24"]')
    ).not.toBeNull();
  });

  it("says the feature is stopped, and that nothing would be rendered", async () => {
    answerBoth(stoppedSettings);

    renderScreen();

    await screen.findByText(en.admin.budgetStopped);
    // activeModelId is null: not "unknown", but "nothing would be rendered".
    expect(screen.getByText(en.admin.generationStopped)).toBeInTheDocument();
  });

  it("draws both thresholds on the gauge, not under it as prose", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    expect(screen.getByText(en.admin.threshold85)).toBeInTheDocument();
    expect(screen.getByText(en.admin.threshold100)).toBeInTheDocument();
  });

  it("says the money on this screen is dollars and not pounds", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    expect(screen.getByText("$120.50")).toBeInTheDocument();
    expect(screen.getByText(en.admin.usdNotEgp)).toBeInTheDocument();
    // No figure formatted as pounds anywhere — the only "EGP" on this screen
    // is the sentence explaining that this one number is not in them.
    expect(screen.queryByText(/[\d,]+\.\d\d EGP/)).toBeNull();
  });
});

describe("/admin/try-on — a zero ceiling is a switch-off, not an accident", () => {
  it("calls out a zero ceiling rather than drawing a full gauge", () => {
    expect(ceilingIsZero(zeroCeiling)).toBe(true);
    expect(ceilingIsZero(okSettings)).toBe(false);
  });

  it("says so on the screen", async () => {
    answerBoth(zeroCeiling);

    renderScreen();

    expect(await screen.findByTestId("ceiling-zero")).toHaveTextContent(
      en.admin.budgetZeroBody
    );
  });

  it("says there were no renders rather than drawing an empty list", async () => {
    answerBoth(zeroCeiling);

    renderScreen();

    expect(await screen.findByText(en.admin.noRenders)).toBeInTheDocument();
  });
});

describe("/admin/try-on — switching the model is behind a sheet", () => {
  it("keeps the save disabled until something differs", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    expect(
      screen.getByRole("button", { name: en.admin.saveTryOn })
    ).toBeDisabled();
  });

  it("saves a ceiling change with no sheet, because it is reversible", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    fireEvent.change(screen.getByLabelText(en.admin.monthlyCeiling), {
      target: { value: "60000" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveTryOn }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/admin/try-on/settings");
    expect(body).toEqual({ tryOnMonthlyBudgetCents: 60000 });
  });

  it("names all three consequences before switching provider", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    fireEvent.change(screen.getByLabelText(en.admin.chooseModel), {
      target: { value: FALLBACK },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveTryOn }));

    expect(
      await screen.findByText(en.admin.modelSwitchImmediate)
    ).toBeInTheDocument();
    expect(screen.getByText(en.admin.modelSwitchCost)).toBeInTheDocument();
    expect(screen.getByText(en.admin.modelSwitchNoRollback)).toBeInTheDocument();
    // Nothing was sent yet.
    expect(patch).not.toHaveBeenCalled();
  });

  it("sends only the model once the sheet is confirmed", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    fireEvent.change(screen.getByLabelText(en.admin.chooseModel), {
      target: { value: FALLBACK },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveTryOn }));
    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.modelSwitchAction })
    );

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(body).toEqual({ tryOnModelId: FALLBACK });
  });

  it("shows what each model costs per render, so the choice is informed", async () => {
    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    const select = screen.getByLabelText(en.admin.chooseModel);
    expect(select).toHaveTextContent(`$0.08 ${en.admin.perRender}`);
    expect(select).toHaveTextContent(`$0.04 ${en.admin.perRender}`);
  });

  it("keeps the current model selectable even if the registry no longer offers it", async () => {
    get.mockImplementation((_schema: unknown, path: string) =>
      path.endsWith("/models") ? answer([models[1]]) : answer(okSettings)
    );

    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    // Otherwise the select would silently display a different model than the
    // one actually in use.
    expect(screen.getByLabelText(en.admin.chooseModel)).toHaveValue(MODEL);
  });
});

describe("/admin/try-on — states", () => {
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
      answer(new ApiError(400, "Bad request", "BadRequest"))
    );

    renderScreen();

    await screen.findByText(en.admin.budgetOk);
    fireEvent.change(screen.getByLabelText(en.admin.monthlyCeiling), {
      target: { value: "60000" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveTryOn }));

    expect(await screen.findByText(en.admin.saveFailed)).toBeInTheDocument();
  });
});

describe("/admin/try-on — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    expect(await screen.findByText(ar.admin.tryOnNote)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.tryOnNote)).toBeNull();
  });
});
