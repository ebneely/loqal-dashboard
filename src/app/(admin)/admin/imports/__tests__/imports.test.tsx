import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { importItemSchema, importJobSchema } from "@loqal/contracts/import.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/imports",
  useSearchParams: () => search,
}));

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch, post } };
});

const { ApiError } = await import("@/lib/api");
const { ImportsScreen } = await import("../imports-screen");
const { ImportJobReview } = await import("../[id]/job-review");
const {
  blockersFor,
  isPriceAcceptable,
  wireImportItemSchema,
} = await import("../imports-data");
const { ar } = await import("@/messages/ar");

const JOB_ID = "0199aaaa-0000-7000-8000-000000000001";

const job = importJobSchema.parse({
  id: JOB_ID,
  brandId: "0199dddd-0000-7000-8000-000000000001",
  brandName: "Nile Ceramics",
  sourceType: "SHOPIFY",
  sourceRef: "https://example.myshopify.com",
  status: "AWAITING_REVIEW",
  counts: { staged: 2, mapped: 1, imported: 0, skipped: 1, failed: 3 },
  failureReason: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  completedAt: null,
});

/** Exactly what `toWireItem` sends: flat name, and NO `missingName` key. */
const readyItem = {
  id: "0199bbbb-0000-7000-8000-000000000001",
  status: "MAPPED",
  sourceTitle: "Glazed bowl - blue",
  mappedName: "Glazed bowl",
  mappedPrice: "149.90",
  mappedCategoryId: "0199cccc-0000-7000-8000-000000000001",
  missingPrice: false,
  failureReason: null,
};

const namelessItem = {
  ...readyItem,
  id: "0199bbbb-0000-7000-8000-000000000002",
  status: "STAGED",
  sourceTitle: "TEST PRODUCT",
  mappedName: null,
  mappedPrice: "10.00",
  missingPrice: false,
};

const pricelessItem = {
  ...readyItem,
  id: "0199bbbb-0000-7000-8000-000000000003",
  status: "STAGED",
  mappedPrice: null,
  missingPrice: true,
};

const skippedItem = {
  ...readyItem,
  id: "0199bbbb-0000-7000-8000-000000000004",
  status: "SKIPPED",
  mappedName: null,
  mappedPrice: null,
  missingPrice: true,
};

const jobsPage = { items: [job], nextCursor: null };
const itemsPage = { items: [readyItem], nextCursor: null };
const blockedItemsPage = {
  items: [readyItem, namelessItem, pricelessItem],
  nextCursor: null,
};

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const wrap = (node: React.ReactNode, locale: "en" | "ar" = "en") =>
  render(<LocaleProvider locale={locale}>{node}</LocaleProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  patch.mockImplementation(() => answer(readyItem));
  post.mockImplementation(() => answer({ imported: 2, failed: 0 }));
});

describe("the item shape the API actually sends", () => {
  it("cannot be parsed by the contract's own importItemSchema", () => {
    // `toWireItem` never writes `missingName`, and the contract requires it —
    // not optional, not nullable. Parsing a real response fails on EVERY row.
    expect(importItemSchema.safeParse(readyItem).success).toBe(false);
  });

  it("parses against the wire schema described beside the fetch", () => {
    expect(wireImportItemSchema.safeParse(readyItem).success).toBe(true);
  });

  it("sends a FLAT mappedName where the contract declares a bilingual object", () => {
    // The publish step files whatever it is given as English, so an Arabic-only
    // product name does not survive it. Offering a second box would accept text
    // that silently never arrives.
    expect(typeof readyItem.mappedName).toBe("string");
    expect(
      importItemSchema.safeParse({ ...readyItem, missingName: false }).success
    ).toBe(false);
  });
});

describe("blockersFor — both blockers are flagged, one of them derived", () => {
  it("flags a missing name even though the API never sends the flag", () => {
    expect(blockersFor(wireImportItemSchema.parse(namelessItem))).toEqual([
      "MISSING_NAME",
    ]);
  });

  it("flags a missing price", () => {
    expect(blockersFor(wireImportItemSchema.parse(pricelessItem))).toEqual([
      "MISSING_PRICE",
    ]);
  });

  it("flags nothing on a row that is ready", () => {
    expect(blockersFor(wireImportItemSchema.parse(readyItem))).toEqual([]);
  });

  it("flags nothing on a SKIPPED row, which publish leaves alone", () => {
    expect(blockersFor(wireImportItemSchema.parse(skippedItem))).toEqual([]);
  });

  it("treats whitespace as no name at all", () => {
    expect(
      blockersFor(
        wireImportItemSchema.parse({ ...namelessItem, mappedName: "   " })
      )
    ).toEqual(["MISSING_NAME"]);
  });
});

describe("isPriceAcceptable — never invent a price", () => {
  it("accepts empty, which means clear it", () => {
    // A missing price is a real state and NEVER a zero.
    expect(isPriceAcceptable("")).toBe(true);
    expect(isPriceAcceptable("  ")).toBe(true);
  });

  it("accepts what moneySchema accepts", () => {
    expect(isPriceAcceptable("149.90")).toBe(true);
    expect(isPriceAcceptable("149.9")).toBe(true);
    expect(isPriceAcceptable("149")).toBe(true);
  });

  it("refuses what the API would refuse", () => {
    for (const bad of ["-1", "1.999", "1,200", "abc", "1e3"]) {
      expect(isPriceAcceptable(bad), bad).toBe(false);
    }
  });
});

describe("/admin/imports — per-status counts, never one number", () => {
  // Braces, deliberately: an arrow that RETURNS `get.mockImplementation(...)`
  // returns the mock itself, and Vitest treats a function returned from
  // `beforeEach` as a teardown callback — so it calls `get()` with no arguments
  // after every test in the block.
  beforeEach(() => {
    get.mockImplementation(() => answer(jobsPage));
  });

  it("shows every count and tints only the failed one", async () => {
    const { container } = wrap(<ImportsScreen />);

    await screen.findAllByText(job.brandName);
    expect(container.querySelector('[data-failed="true"]')).not.toBeNull();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("gives every job its own address", async () => {
    wrap(<ImportsScreen />);

    const links = await screen.findAllByRole("link", { name: job.brandName });
    expect(links[0]).toHaveAttribute("href", `/admin/imports/${JOB_ID}`);
  });

  it("says there is no published item status and never will be", async () => {
    wrap(<ImportsScreen />);

    await screen.findAllByText(job.brandName);
    expect(screen.getByText(en.admin.noPublishedStatus)).toBeInTheDocument();
  });

  it("says a shop cannot start an import itself, in the empty state", async () => {
    get.mockImplementation(() => answer({ items: [], nextCursor: null }));

    wrap(<ImportsScreen />);

    expect(
      await screen.findByText(en.admin.importsEmptyBody)
    ).toBeInTheDocument();
  });

  it("draws denied on a 403 and names the role", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    wrap(<ImportsScreen />);

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });
});

describe("/admin/imports/[id] — flagged before the publish, not after", () => {
  const answerBoth = (items: unknown) =>
    get.mockImplementation((_schema: unknown, path: string) =>
      path.endsWith("/items") ? answer(items) : answer(job)
    );

  it("counts the rows that cannot publish yet", async () => {
    answerBoth(blockedItemsPage);

    wrap(<ImportJobReview id={JOB_ID} />);

    const panel = await screen.findByTestId("publish-blocked");
    expect(panel).toHaveTextContent(
      en.admin.blockedBeforePublish.replace("{n}", "2")
    );
  });

  it("flags the missing name and the missing price on their own rows", async () => {
    answerBoth(blockedItemsPage);

    const { container } = wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByTestId("publish-blocked");
    expect(
      container.querySelector('[data-blocker="MISSING_NAME"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-blocker="MISSING_PRICE"]')
    ).not.toBeNull();
  });

  it("refuses the publish while anything is flagged", async () => {
    answerBoth(blockedItemsPage);

    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByTestId("publish-blocked");
    expect(await screen.findByTestId("publish-refused")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.publishAction })
    ).toBeDisabled();
  });

  it("allows the publish once nothing is flagged", async () => {
    answerBoth(itemsPage);

    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByText(en.admin.nothingBlocked);
    expect(screen.queryByTestId("publish-refused")).toBeNull();
    expect(
      screen.getByRole("button", { name: en.admin.publishAction })
    ).toBeEnabled();
  });

  it("names all three consequences and reports the counts back", async () => {
    answerBoth(itemsPage);

    wrap(<ImportJobReview id={JOB_ID} />);

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.publishAction })
    );
    expect(await screen.findByText(en.admin.publishAsDraft)).toBeInTheDocument();
    expect(screen.getByText(en.admin.publishSkipsSkipped)).toBeInTheDocument();
    expect(screen.getByText(en.admin.publishRehosts)).toBeInTheDocument();

    const confirms = screen.getAllByRole("button", {
      name: en.admin.publishAction,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toBe(`/v1/admin/imports/${JOB_ID}/publish`);
    expect(
      await screen.findByText(
        en.admin.publishResult.replace("{imported}", "2").replace("{failed}", "0")
      )
    ).toBeInTheDocument();
  });
});

describe("/admin/imports/[id] — editing a row", () => {
  beforeEach(() => {
    get.mockImplementation((_schema: unknown, path: string) =>
      path.endsWith("/items") ? answer(itemsPage) : answer(job)
    );
  });

  it("offers ONE name box, because the backend stores one string", async () => {
    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByText(en.admin.nothingBlocked);
    expect(screen.getAllByLabelText(en.admin.itemNameEn)).toHaveLength(1);
    // A second box would write into a field the publish step does not read.
    expect(screen.queryByLabelText(en.admin.itemNameAr)).toBeNull();
    expect(screen.getByText(en.admin.mappedNameGap)).toBeInTheDocument();
  });

  it("sends the flat body the API accepts, not the contract's bilingual one", async () => {
    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByText(en.admin.nothingBlocked);
    fireEvent.change(screen.getByLabelText(en.admin.itemNameEn), {
      target: { value: "Glazed bowl, blue" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveItem }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/imports/${JOB_ID}/items/${readyItem.id}`);
    expect(body).toEqual({
      mappedName: "Glazed bowl, blue",
      mappedPrice: "149.90",
    });
  });

  it("clears a price to null rather than sending zero", async () => {
    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByText(en.admin.nothingBlocked);
    fireEvent.change(screen.getByLabelText(en.admin.price), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveItem }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(body).toMatchObject({ mappedPrice: null });
  });

  it("refuses to save a price the API would reject, before the request", async () => {
    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByText(en.admin.nothingBlocked);
    fireEvent.change(screen.getByLabelText(en.admin.price), {
      target: { value: "12.999" },
    });

    expect(screen.getByRole("button", { name: en.admin.saveItem })).toBeDisabled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("sends needsAttention only when it is on, because 'false' would be true", async () => {
    wrap(<ImportJobReview id={JOB_ID} />);

    await screen.findByText(en.admin.nothingBlocked);
    const itemCall = get.mock.calls.find((call) =>
      String(call[1]).endsWith("/items")
    ) as [unknown, string, { query?: Record<string, unknown> }];
    expect(itemCall[2].query?.needsAttention).toBeUndefined();

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      const on = get.mock.calls.filter(
        (call) =>
          String(call[1]).endsWith("/items") &&
          (call[2] as { query?: Record<string, unknown> }).query
            ?.needsAttention === true
      );
      expect(on.length).toBeGreaterThan(0);
    });
  });
});

describe("/admin/imports/[id] — failure states", () => {
  it("draws notFound, with a way back, on a 404", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(404, "Import job not found", "NotFound"))
    );

    wrap(<ImportJobReview id={JOB_ID} />);

    expect(
      await screen.findByText(en.admin.jobNotFoundTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.admin.backToImports })
    ).toHaveAttribute("href", "/admin/imports");
  });
});

describe("/admin/imports — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    get.mockImplementation(() => answer(jobsPage));

    wrap(<ImportsScreen />, "ar");

    await screen.findAllByText(job.brandName);
    expect(screen.getByText(ar.admin.noAutoPublishBody)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.noAutoPublishBody)).toBeNull();
  });
});
