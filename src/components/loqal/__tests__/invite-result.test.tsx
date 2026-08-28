import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";

const { InviteResult } = await import("../invite-result");

const a = en.admin;

const labels = {
  title: a.inviteResult,
  copyLink: a.copyLink,
  copyLinkHint: a.copyLinkHint,
  copied: a.copied,
  copyFailed: a.copyFailed,
  outcomes: {
    sent: a.outcomeSent,
    skipped: a.outcomeSkipped,
    failed: a.outcomeFailed,
    "not-configured": a.outcomeNotConfigured,
  },
};

const steps = [
  { key: "brand", label: a.stepBrand, outcome: "done" as const },
  { key: "owner", label: a.stepOwner, outcome: "sent" as const },
  { key: "whatsapp", label: a.stepWhatsApp, outcome: "skipped" as const },
  { key: "email", label: a.stepEmail, outcome: "not-configured" as const },
  { key: "extra", label: "Something else", outcome: "failed" as const },
];

const URL = "https://dash.test/set-password?token=abc";

const renderPanel = (inviteUrl: string | null = URL) =>
  render(
    <InviteResult steps={steps} inviteUrl={inviteUrl} labels={labels} />
  );

/** jsdom defines `navigator.clipboard` on no origin at all, so both halves of
 *  the fallback have to be installed and removed by hand. */
const withClipboard = (writeText: () => Promise<void>) => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
};

const withoutClipboard = () => {
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  withoutClipboard();
});

describe("InviteResult — every outcome is a different fact", () => {
  it("names each outcome rather than reducing four of them to success and failure", () => {
    renderPanel();

    expect(screen.getByText(a.outcomeSent)).toBeInTheDocument();
    expect(screen.getByText(a.outcomeSkipped)).toBeInTheDocument();
    expect(screen.getByText(a.outcomeNotConfigured)).toBeInTheDocument();
    expect(screen.getByText(a.outcomeFailed)).toBeInTheDocument();
  });

  it("gives each outcome its tone from the state tokens and no other colour", () => {
    const { container } = renderPanel();

    const tone = (key: string) =>
      container.querySelector(`[data-step="${key}"]`)?.className ?? "";

    expect(tone("brand")).toContain("text-state-good-fg");
    expect(tone("owner")).toContain("text-state-good-fg");
    expect(tone("whatsapp")).toContain("text-state-wait-fg");
    expect(tone("email")).toContain("text-state-wait-fg");
    expect(tone("extra")).toContain("text-state-bad-fg");
  });

  it("renders the link as text, not only behind a button", () => {
    // The button is the convenience. The text is what makes the link
    // recoverable when the button cannot work at all.
    renderPanel();
    expect(screen.getByText(URL)).toBeInTheDocument();
  });

  it("offers no copy button when there is no link to copy", () => {
    renderPanel(null);
    expect(screen.queryByRole("button", { name: a.copyLink })).toBeNull();
  });
});

describe("InviteResult — the clipboard is not always there", () => {
  it("reports failure and never success when navigator.clipboard is absent", async () => {
    // Plain HTTP on a LAN is an insecure origin, and this dashboard is served
    // over exactly that. `navigator.clipboard` is undefined there.
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: a.copyLink }));

    expect(await screen.findByText(a.copyFailed)).toBeInTheDocument();
    expect(screen.queryByText(a.copied)).toBeNull();
  });

  it("selects the link text so it can be copied by hand", () => {
    const removeAllRanges = vi.fn();
    const addRange = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      removeAllRanges,
      addRange,
    } as unknown as Selection);

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: a.copyLink }));

    expect(addRange).toHaveBeenCalled();
  });

  it("reports failure, not success, when writeText rejects", async () => {
    withClipboard(() => Promise.reject(new Error("denied")));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: a.copyLink }));

    expect(await screen.findByText(a.copyFailed)).toBeInTheDocument();
    expect(screen.queryByText(a.copied)).toBeNull();
  });

  it("says copied only when something was actually copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: a.copyLink }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL));
    expect(await screen.findByText(a.copied)).toBeInTheDocument();
    expect(screen.queryByText(a.copyFailed)).toBeNull();
  });
});
