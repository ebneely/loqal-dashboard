import { describe, expect, it } from "vitest";

import { en } from "@/messages/en";

import {
  brandThreadListSchema,
  byLongestUnanswered,
  chatMessageListSchema,
  escalationFor,
  longestWaiting,
  partyOf,
  remainingLabel,
  unreadUpTo,
} from "../chat-wire";
import {
  NOW,
  brandMessage,
  escalatedThread,
  quietThread,
  shopperMessage,
  threadList,
  threadMessages,
  waitingThread,
} from "./fixtures";

const now = NOW.getTime();

describe("chat fixtures match the shape the API ships", () => {
  it("parses every thread and every message", () => {
    expect(brandThreadListSchema.safeParse(threadList).success).toBe(true);
    expect(chatMessageListSchema.safeParse(threadMessages).success).toBe(true);
  });

  it("drops a field the API has no business sending to a brand", () => {
    const parsed = brandThreadListSchema.parse([
      { ...waitingThread, internalNote: "not for this plane" },
    ]);
    expect(parsed[0]).not.toHaveProperty("internalNote");
  });
});

describe("the escalation countdown", () => {
  it("counts down to the threshold the API sent, not to a constant", () => {
    const escalation = escalationFor(waitingThread, now);

    expect(escalation.stage).toBe("waiting");
    expect(escalation.minutesLeft).toBe(8);
    expect(escalation.thresholdMinutes).toBe(30);
  });

  /**
   * The whole reason the countdown exists. A brand should see the hand-off
   * coming, so 22 of 30 minutes is roughly three quarters of the way there and
   * the bar says so.
   */
  it("reports how far through the window the wait is", () => {
    expect(escalationFor(waitingThread, now).percent).toBe(73);
  });

  it("reads a fired escalation as fired", () => {
    const escalation = escalationFor(escalatedThread, now);

    expect(escalation.stage).toBe("escalated");
    expect(escalation.minutesLeft).toBeNull();
    expect(escalation.percent).toBe(100);
  });

  /**
   * The server decided against its own clock at read time; this tab's clock
   * kept running. Either saying "fired" is enough — a countdown that ticks past
   * zero and still promises time left is the one failure nobody forgives.
   */
  it("fires on the local clock even when the server flag says otherwise", () => {
    const stale = { ...escalatedThread, escalationFired: false };
    expect(escalationFor(stale, now).stage).toBe("escalated");
  });

  it("trusts the server flag even when the local clock has not got there", () => {
    const early = { ...waitingThread, escalationFired: true };
    expect(escalationFor(early, now).stage).toBe("escalated");
  });

  it("runs no clock at all once the shop has replied", () => {
    const escalation = escalationFor(quietThread, now);

    expect(escalation.stage).toBe("quiet");
    expect(escalation.waitedMs).toBe(-1);
    expect(escalation.minutesLeft).toBeNull();
  });

  it("never says zero minutes left", () => {
    const nearlyThere = {
      ...waitingThread,
      oldestUnansweredMessageAt: new Date(now - 29.9 * 60_000).toISOString(),
    };
    expect(escalationFor(nearlyThere, now).minutesLeft).toBe(1);
  });

  it("speaks the same two phrases an elapsed time does", () => {
    expect(remainingLabel(8, en)).toBe("8 min");
    expect(remainingLabel(150, en)).toBe("2 h");
    expect(remainingLabel(null, en)).toBeNull();
  });
});

describe("ranking a shop's inbox", () => {
  it("puts the longest wait first and the answered ones last", () => {
    const ranked = byLongestUnanswered(threadList, now);

    expect(ranked.map((thread) => thread.id)).toEqual([
      escalatedThread.id,
      waitingThread.id,
      quietThread.id,
    ]);
  });

  it("offers the longest RUNNING wait as the one thing to act on", () => {
    expect(longestWaiting(threadList, now)?.id).toBe(escalatedThread.id);
  });

  it("offers nothing to act on when every conversation is answered", () => {
    expect(longestWaiting([quietThread], now)).toBeNull();
  });
});

describe("who is on the other side", () => {
  it("tells a guest from a registered shopper and invents nothing else", () => {
    expect(partyOf(waitingThread)).toBe("GUEST");
    expect(partyOf(quietThread)).toBe("SHOPPER");
    expect(partyOf({ ...quietThread, customerId: null })).toBeNull();
  });
});

describe("what a brand marks read on opening", () => {
  it("marks up to the newest message when the shopper spoke last", () => {
    expect(unreadUpTo(threadMessages)).toBe(
      threadMessages[threadMessages.length - 1]?.id
    );
  });

  it("marks nothing when the shop already answered", () => {
    expect(unreadUpTo([shopperMessage, brandMessage])).toBeNull();
  });

  it("marks nothing when the newest message is already read", () => {
    expect(
      unreadUpTo([{ ...shopperMessage, readAt: NOW.toISOString() }])
    ).toBeNull();
  });

  it("marks nothing in an empty thread", () => {
    expect(unreadUpTo([])).toBeNull();
  });
});
