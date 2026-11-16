import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import { ownerProfile } from "./fixtures";

const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, patch } };
});

let role = "BRAND_OWNER";
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { role } }, isPending: false }),
}));

const { DeliveryTimeSection } = await import("../delivery-time-section");
const d = en.brand.deliveryTime;

const renderSection = (initial: { minMinutes: number; maxMinutes: number } | null) =>
  render(
    <LocaleProvider locale="en">
      <DeliveryTimeSection initial={initial} />
    </LocaleProvider>
  );

beforeEach(() => {
  role = "BRAND_OWNER";
  patch.mockReset();
  patch.mockResolvedValue(ownerProfile);
});

describe("delivery time", () => {
  it("saves a preset, whole, at the top level", async () => {
    renderSection(null);

    fireEvent.click(screen.getByLabelText(d.presets.oneToTwoHours));
    fireEvent.click(screen.getByRole("button", { name: d.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/brands/me");
    expect(body).toEqual({ deliveryTime: { minMinutes: 60, maxMinutes: 120 } });
  });

  it("clears it with null", async () => {
    renderSection({ minMinutes: 60, maxMinutes: 120 });

    fireEvent.click(screen.getByLabelText(d.none));
    fireEvent.click(screen.getByRole("button", { name: d.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][2]).toEqual({ deliveryTime: null });
  });

  it("names a custom range the server would refuse, and does not send it", () => {
    renderSection(null);

    fireEvent.click(screen.getByLabelText(d.custom));
    fireEvent.change(screen.getByLabelText(d.from), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(d.to), { target: { value: "2" } });

    expect(screen.getByText(d.invalid)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: d.save })).toBeDisabled();
  });

  it("shows an employee the range as text, with no controls", () => {
    role = "BRAND_EMPLOYEE";
    renderSection({ minMinutes: 1440, maxMinutes: 2880 });

    expect(screen.getByText(d.presets.oneToTwoDays)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.save })).toBeNull();
  });
});
