import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const replace = vi.fn();
const useSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

import Home from "./page";

const signedIn = (role: string, mustChangePassword = false) => ({
  data: { user: { role, mustChangePassword } },
  isPending: false,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/", () => {
  /**
   * `/` is a signpost, not a screen. It used to render a scaffold heading,
   * which meant a signed-in user landed on marketing copy and had to know a
   * route by heart to reach their own console.
   */
  it("renders nothing — a heading that flashes and vanishes reads as a glitch", () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    const { container } = render(<Home />);

    expect(container).toBeEmptyDOMElement();
  });

  it("waits while the session is still loading, rather than bouncing to sign-in", () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    render(<Home />);

    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    render(<Home />);

    expect(replace).toHaveBeenCalledWith("/sign-in");
  });

  it("sends each role to its own console, not everyone to the brand one", () => {
    for (const [role, home] of [
      ["SUPER_ADMIN", "/admin/applications"],
      ["SALES", "/sales/pack"],
      ["BRAND_OWNER", "/today"],
      ["BRAND_EMPLOYEE", "/today"],
    ] as const) {
      replace.mockClear();
      useSession.mockReturnValue(signedIn(role));

      render(<Home />);

      expect(replace, `${role} should land on ${home}`).toHaveBeenCalledWith(home);
    }
  });

  it("sends a shopper back to sign-in rather than into a console that 403s", () => {
    useSession.mockReturnValue(signedIn("SHOPPER"));

    render(<Home />);

    expect(replace).toHaveBeenCalledWith("/sign-in?denied=no-console");
  });

  it("puts a forced password change ahead of any console", () => {
    // A console the user cannot act in is not a useful landing.
    useSession.mockReturnValue(signedIn("BRAND_OWNER", true));

    render(<Home />);

    expect(replace).toHaveBeenCalledWith("/set-password");
  });
});
