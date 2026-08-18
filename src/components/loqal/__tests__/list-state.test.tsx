import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ListState, listStateFor } from "../list-state";
import { ApiError } from "@/lib/api";
import { en } from "@/messages/en";

describe("ListState", () => {
  it("draws permission-denied as a state, not a toast", () => {
    // The three consoles differ mostly by what a user may not see, so this is
    // ordinary traffic. A toast fades and leaves someone looking at an empty
    // screen unable to tell whether the data is missing or they are.
    render(
      <ListState
        state="denied"
        title={en.brand.deniedTitle}
        body={en.brand.deniedBody}
        requiredRole="BRAND_OWNER"
      />
    );

    expect(screen.getByText(en.brand.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.deniedBody)).toBeInTheDocument();
    expect(screen.getByText("BRAND_OWNER")).toBeInTheDocument();
  });

  it("announces an error to assistive technology", () => {
    render(
      <ListState
        state="error"
        title={en.brand.errorTitle}
        body={en.brand.errorBody}
        actionLabel={en.brand.retry}
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retries through the caller's handler", () => {
    const onAction = vi.fn();
    render(
      <ListState
        state="error"
        title={en.brand.errorTitle}
        actionLabel={en.brand.retry}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: en.brand.retry }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it("marks the loading state busy and draws the number of rows asked for", () => {
    const { container } = render(<ListState state="loading" rows={5} />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-slot="card"]').length
    ).toBe(5);
  });

  it("keeps empty and denied distinct — nothing there versus not yours", () => {
    const { container } = render(
      <ListState state="empty" title={en.brand.ordersEmptyTitle} />
    );

    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(container.querySelector('[data-state="denied"]')).toBeNull();
  });

  it("draws notFound as its own state, distinct from empty", () => {
    /**
     * 404 is first-class on every detail route, and here it doubles as "this
     * belongs to another shop" — the backend answers 404 rather than 403 so the
     * route is not an enumeration oracle. Rendering state="empty" with a 404
     * title, which is what the orders screen had to do, conflates "there is
     * nothing" with "there is something and it is not yours".
     */
    const { container } = render(
      <ListState
        state="notFound"
        title={en.brand.orderNotFoundTitle}
        body={en.brand.orderNotFoundBody}
      />
    );

    expect(container.querySelector('[data-state="notFound"]')).not.toBeNull();
    expect(container.querySelector('[data-state="empty"]')).toBeNull();
    expect(screen.getByText(en.brand.orderNotFoundTitle)).toBeInTheDocument();
  });

  it("does not announce notFound as an alert", () => {
    // A dead end the user navigated to is not a system failure.
    render(<ListState state="notFound" title={en.brand.orderNotFoundTitle} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the action as a real link when given actionHref", () => {
    // `onAction` is a button only, so any state that should NAVIGATE had to be
    // composed as a Button asChild + Link beside the panel. Every screen did it.
    render(
      <ListState
        state="notFound"
        title={en.brand.orderNotFoundTitle}
        actionLabel={en.brand.allOrders}
        actionHref="/orders"
      />
    );

    const link = screen.getByRole("link", { name: en.brand.allOrders });
    expect(link).toHaveAttribute("href", "/orders");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("still renders a button when only onAction is given", () => {
    const onAction = vi.fn();
    render(
      <ListState
        state="empty"
        title={en.brand.ordersEmptyTitle}
        actionLabel={en.brand.retry}
        onAction={onAction}
      />
    );

    expect(screen.getByRole("button", { name: en.brand.retry })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  describe("listStateFor", () => {
    it("maps a 404 to notFound only when the caller asks for it", () => {
      // Opt-in on purpose. Every screen shipping today branches on "error" for
      // a 404; flipping that silently would leave them rendering nothing.
      const missing = new ApiError(404, "Not found", "NotFound");

      expect(listStateFor(missing)).toBe("error");
      expect(listStateFor(missing, { notFound: true })).toBe("notFound");
    });

    it("keeps denied ahead of notFound", () => {
      const denied = new ApiError(403, "Only the owner", "Forbidden");
      expect(listStateFor(denied, { notFound: true })).toBe("denied");
    });

    it("maps a 403 to denied rather than to error", () => {
      const denied = new ApiError(403, "Only the owner", "Forbidden");
      expect(listStateFor(denied)).toBe("denied");
    });

    it("maps any other failure to error", () => {
      expect(listStateFor(new ApiError(500, "boom", "Internal"))).toBe("error");
      expect(listStateFor(new Error("network"))).toBe("error");
    });

    it("prefers loading over everything, and returns null when there is data", () => {
      expect(listStateFor(null, { isLoading: true })).toBe("loading");
      expect(listStateFor(null, { isEmpty: true })).toBe("empty");
      expect(listStateFor(null, {})).toBeNull();
    });
  });
});
