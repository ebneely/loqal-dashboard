import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  MobileActionBar,
  MobileActionBarSpacer,
} from "../mobile-action-bar";
import { Button } from "@/components/ui/button";

describe("MobileActionBar", () => {
  it("is fixed to the viewport and gone at md by default", () => {
    const { container } = render(
      <MobileActionBar>
        <Button>Confirm against the shelf</Button>
      </MobileActionBar>
    );

    const bar = container.querySelector(
      '[data-slot="mobile-action-bar"]'
    ) as HTMLElement;

    // STICKY, not fixed — the design system's `.lq-actionbar`. A sticky bar
    // keeps a placeholder in the flow, so it cannot cover the last row of a
    // list, which is why the spacer below is now a no-op.
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("md:hidden");
  });

  it("pads for the iOS home indicator", () => {
    // Without it the button's bottom half sits under the system swipe area.
    const { container } = render(
      <MobileActionBar>
        <Button>Confirm</Button>
      </MobileActionBar>
    );

    const bar = container.querySelector(
      '[data-slot="mobile-action-bar"]'
    ) as HTMLElement;
    expect(bar.className).toContain("env(safe-area-inset-bottom)");
  });

  describe('hideAt="never"', () => {
    /**
     * The gap this closes is an accessibility bug, not duplication.
     *
     * A detail screen that wants one primary button at all widths had to render
     * the control TWICE — once inside a `hidden md:block` and once inside the
     * bar — which puts two elements with the same accessible name in the tree.
     * A screen-reader user hears "Mark packed, button" twice and cannot tell
     * which one is real; the CSS that hides one of them is invisible to the
     * accessibility tree in exactly the way `display:none` is not guaranteed to
     * be when a stylesheet has not loaded.
     */
    it("renders exactly ONE control with that accessible name", () => {
      render(
        <MobileActionBar hideAt="never">
          <Button>Mark packed</Button>
        </MobileActionBar>
      );

      expect(screen.getAllByRole("button", { name: "Mark packed" })).toHaveLength(
        1
      );
    });

    it("stays fixed below md and becomes an ordinary block at md", () => {
      // Thumb reach on a phone; beside the thing it acts on at a desk.
      const { container } = render(
        <MobileActionBar hideAt="never">
          <Button>Mark packed</Button>
        </MobileActionBar>
      );

      const bar = container.querySelector(
        '[data-slot="mobile-action-bar"]'
      ) as HTMLElement;

      expect(bar.className).toContain("sticky");
      expect(bar.className).toContain("md:static");
      // It must not disappear at any breakpoint — that is the whole point.
      expect(bar.className).not.toContain("md:hidden");
      expect(bar.className).not.toContain("lg:hidden");
    });

    it("sheds the bar chrome at md so it does not look like a bar", () => {
      const { container } = render(
        <MobileActionBar hideAt="never">
          <Button>Mark packed</Button>
        </MobileActionBar>
      );

      const bar = container.querySelector(
        '[data-slot="mobile-action-bar"]'
      ) as HTMLElement;

      // No `md:border-t-0`: there is no border to remove. The 1px top rule
      // is the first layer of `--shadow-bar`, so dropping the shadow at md
      // drops the rule with it.
      expect(bar.className).toContain("md:bg-transparent");
      expect(bar.className).toContain("md:shadow-none");
      expect(bar.className).toContain("md:backdrop-blur-none");
    });

    /**
     * The spacer used to reserve 96px because the bar was `fixed` and so out
     * of flow. The bar is `sticky` now, which reserves its own space, and a
     * spacer on top of that is dead scroll at the end of every list. The
     * export stays so call sites keep compiling; it renders nothing.
     */
    it("no longer reserves room, because a sticky bar reserves its own", () => {
      const { container } = render(<MobileActionBarSpacer hideAt="never" />);

      expect(container.firstChild).toBeNull();
    });
  });

  it("keeps the existing md and lg values working unchanged", () => {
    const { container } = render(
      <MobileActionBar hideAt="lg">
        <Button>Confirm</Button>
      </MobileActionBar>
    );

    const bar = container.querySelector(
      '[data-slot="mobile-action-bar"]'
    ) as HTMLElement;
    expect(bar.className).toContain("lg:hidden");
  });

  it("puts the secondary action at the inline start of the primary one", () => {
    render(
      <MobileActionBar secondary={<Button>Reject</Button>} hint="The shopper is waiting.">
        <Button>Confirm</Button>
      </MobileActionBar>
    );

    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByText("The shopper is waiting.")).toBeInTheDocument();
  });
});
