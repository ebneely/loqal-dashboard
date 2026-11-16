import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import { ownerProfile } from "./fixtures";

/**
 * The shop's map position. The map itself (Leaflet) cannot draw in jsdom, so
 * it is replaced by two buttons that report a point the way a click on the map
 * would; everything around it — the bounds, the save, the clear — is real.
 */
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, patch } };
});

let role = "BRAND_OWNER";
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { role } }, isPending: false }),
}));

vi.mock("../location-map", () => ({
  default: ({ onPick }: { onPick: (p: { latitude: number; longitude: number }) => void }) => (
    <div>
      <button type="button" onClick={() => onPick({ latitude: 31.2001, longitude: 29.9187 })}>
        pick-alexandria
      </button>
      <button type="button" onClick={() => onPick({ latitude: 51.5, longitude: -0.12 })}>
        pick-london
      </button>
    </div>
  ),
}));

const { LocationSection } = await import("../location-section");
const l = en.brand.location;

const renderSection = (initial: { latitude: number; longitude: number } | null) =>
  render(
    <LocaleProvider locale="en">
      <LocationSection initial={initial} />
    </LocaleProvider>
  );

beforeEach(() => {
  role = "BRAND_OWNER";
  patch.mockReset();
  patch.mockResolvedValue(ownerProfile);
});

describe("shop location", () => {
  it("saves a picked point, whole, at the top level", async () => {
    renderSection(null);

    fireEvent.click(await screen.findByText("pick-alexandria"));
    expect(screen.getByTestId("location-coords")).toHaveTextContent("31.20010");
    fireEvent.click(screen.getByRole("button", { name: l.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/brands/me");
    expect(body).toEqual({ location: { latitude: 31.2001, longitude: 29.9187 } });
    expect(await screen.findByText(l.saved)).toBeInTheDocument();
  });

  it("clears the location with null", async () => {
    renderSection({ latitude: 30.0444, longitude: 31.2357 });

    fireEvent.click(screen.getByRole("button", { name: l.remove }));
    expect(screen.getByTestId("location-coords")).toHaveTextContent(l.notSet);
    fireEvent.click(screen.getByRole("button", { name: l.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][2]).toEqual({ location: null });
  });

  it("refuses a point outside Egypt before the server has to", async () => {
    renderSection(null);

    fireEvent.click(await screen.findByText("pick-london"));

    expect(screen.getByRole("alert")).toHaveTextContent(l.outsideEgypt);
    expect(screen.getByRole("button", { name: l.save })).toBeDisabled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("says so when the browser refuses the location", async () => {
    const getCurrentPosition = vi.fn(
      (_ok: PositionCallback, fail?: PositionErrorCallback | null) =>
        fail?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError)
    );
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });
    renderSection(null);

    fireEvent.click(screen.getByRole("button", { name: l.useMine }));

    expect(screen.getByRole("alert")).toHaveTextContent(l.denied);
  });

  it("shows an employee the point as text, with no controls", () => {
    role = "BRAND_EMPLOYEE";
    renderSection({ latitude: 30.0444, longitude: 31.2357 });

    expect(screen.getByText(l.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
