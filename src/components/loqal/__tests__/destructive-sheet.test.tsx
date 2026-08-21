import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DestructiveSheet } from "../destructive-sheet";
import { MobileActionBar } from "../mobile-action-bar";
import { Button } from "@/components/ui/button";

const consequences = [
  "The shopper is refunded in full.",
  "The stock goes back on your shelf.",
  "The order leaves your list and cannot be brought back.",
];

describe("DestructiveSheet", () => {
  it("writes the consequences out in words before it will confirm", () => {
    render(
      <DestructiveSheet
        open
        title="Cancel this order?"
        consequences={consequences}
        confirmLabel="Cancel the order"
        cancelLabel="Keep as it is"
        onConfirm={() => {}}
      />
    );

    for (const line of consequences) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("labels the confirm button with the verb, never with OK", () => {
    render(
      <DestructiveSheet
        open
        title="Cancel this order?"
        consequences={consequences}
        confirmLabel="Cancel the order"
        cancelLabel="Keep as it is"
        onConfirm={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "Cancel the order" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ok$/i })).toBeNull();
  });

  it("confirms through the caller's handler", () => {
    const onConfirm = vi.fn();
    render(
      <DestructiveSheet
        open
        title="Reject this return?"
        consequences={["The shopper is told why."]}
        confirmLabel="Reject the return"
        cancelLabel="Keep as it is"
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reject the return" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("MobileActionBar", () => {
  it("sits at the bottom of the viewport and disappears at md", () => {
    // Thumb reach: the primary action of a phone screen is never top-right.
    const { container } = render(
      <MobileActionBar>
        <Button>Confirm all</Button>
      </MobileActionBar>
    );

    const bar = container.querySelector(
      '[data-slot="mobile-action-bar"]'
    ) as HTMLElement;

    expect(bar.className).toContain("bottom-0");
    // `.lq-actionbar` is sticky, so it reserves its own space rather than
    // floating over the last row of the list behind it.
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("md:hidden");
    expect(bar.className).not.toContain("top-0");
  });

  it("carries a hint under the action", () => {
    render(
      <MobileActionBar hint="Stock is released the moment you confirm.">
        <Button>Confirm all</Button>
      </MobileActionBar>
    );

    expect(
      screen.getByText("Stock is released the moment you confirm.")
    ).toBeInTheDocument();
  });
});
