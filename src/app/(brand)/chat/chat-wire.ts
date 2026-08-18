/**
 * The chat wire, and the countdown worked out from it. No React, no fetch.
 *
 * NOT CONTRACT-BACKED. @loqal/contracts has no chat.contract.ts — the only chat
 * shapes it carries are the enum `ThreadParty` and the PlatformSetting group on
 * the admin contract. The schemas below are read off the shipped API
 * (loqal-backend ChatDashboardController / ChatService / MessageRepository) and
 * are the honest record of that gap rather than an invented shape. They are
 * deliberately NOT `.strict()`: these are another module's raw rows, so a column
 * added upstream must not take a shop's inbox down. When the contracts package
 * grows the real ones, this file deletes.
 *
 * The one thing this file is really about is the escalation clock. After
 * `unansweredThresholdMinutes` an unanswered conversation is passed to the
 * shop's WhatsApp number, and a shop owner should see that coming rather than
 * find out from a customer. That number is per-response PlatformSetting data,
 * never a constant here — every thread carries its own copy.
 */
import { z } from "zod";

import { ThreadPartySchema } from "@loqal/contracts/enums";

import { waitedFor } from "@/lib/waited";

/**
 * A row of `GET /v1/dashboard/chat/threads`.
 *
 * Two absences are load-bearing, and both are worked around in the screen
 * rather than papered over:
 *
 *  - There is NO `unreadCount` and NO `lastSenderType`, so a literal unread
 *    count cannot be rendered at all. `oldestUnansweredMessageAt` is what the
 *    API can say, and it says something better: when the shopper's CURRENT wait
 *    started — the oldest message in the trailing run of unread shopper
 *    messages, not the latest follow-up — resetting the moment the brand
 *    replies.
 *  - There is no name, no email and no phone. A thread carries `customerId` or
 *    `guestId` and nothing else, so the list can say WHICH KIND of shopper is
 *    waiting and cannot say who. Inventing a fuller identity for a guest — who
 *    genuinely has only a first name and an email even where those are
 *    served — would be worse than the gap.
 */
export const brandThreadSchema = z.object({
  id: z.string(),
  customerId: z.string().nullable(),
  guestId: z.string().nullable(),
  /** Null is the support thread with Loqal, which a brand can never be shown. */
  brandId: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
  oldestUnansweredMessageAt: z.string().nullable(),
  /** From PlatformSetting, per response. Never a constant on this plane. */
  unansweredThresholdMinutes: z.number().int(),
  escalationFired: z.boolean(),
});
export type BrandThread = z.infer<typeof brandThreadSchema>;

/** A bare array, not a page envelope. See the gap note in the screen. */
export const brandThreadListSchema = z.array(brandThreadSchema);

export const chatMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  senderType: ThreadPartySchema,
  /** Null when Loqal sent it, matching Message.senderId's nullability. */
  senderId: z.string().nullable(),
  body: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  /**
   * Media IDS, not URLs — the same shape the brand profile carries for its
   * logo. Nothing on this plane resolves one to an address, so an attachment
   * can be shown to exist and cannot be opened.
   */
  attachments: z
    .array(z.object({ mediaId: z.string() }))
    .optional()
    .default([]),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatMessageListSchema = z.array(chatMessageSchema);

// ---------------------------------------------------------------------------
// Who is on the other side
// ---------------------------------------------------------------------------

export type ThreadPartyKind = "SHOPPER" | "GUEST";

/**
 * Registered shopper or guest, from which id the thread carries.
 *
 * `Thread` is unique on `[customerId, brandId]` and on `[guestId, brandId]`, so
 * exactly one of the two is set in practice. Null is still answered honestly
 * rather than guessed into "shopper".
 */
export function partyOf(thread: BrandThread): ThreadPartyKind | null {
  if (thread.guestId) return "GUEST";
  if (thread.customerId) return "SHOPPER";
  return null;
}

// ---------------------------------------------------------------------------
// The countdown
// ---------------------------------------------------------------------------

/**
 * `quiet`      no clock is running — the shop has answered, or nobody has
 *              written. Not the same as "read".
 * `waiting`    a shopper is waiting and the threshold has not been reached.
 * `escalated`  it has been passed to the shop's WhatsApp number.
 */
export type EscalationStage = "quiet" | "waiting" | "escalated";

export type Escalation = {
  stage: EscalationStage;
  /** Milliseconds the current run has waited. -1 when no clock is running. */
  waitedMs: number;
  /** Whole minutes left. Null when there is no clock, or it already fired. */
  minutesLeft: number | null;
  /** 0–100 of the way to the threshold, for a progress bar. */
  percent: number;
  /** The threshold this thread was scored against, in minutes. */
  thresholdMinutes: number;
};

const MINUTE = 60_000;

export function escalationFor(
  thread: BrandThread,
  now: number = Date.now()
): Escalation {
  const thresholdMinutes = Math.max(1, thread.unansweredThresholdMinutes);
  const waitedMs = waitedFor(thread.oldestUnansweredMessageAt, now);

  if (waitedMs < 0) {
    return {
      stage: "quiet",
      waitedMs: -1,
      minutesLeft: null,
      percent: 0,
      thresholdMinutes,
    };
  }

  const thresholdMs = thresholdMinutes * MINUTE;
  const percent = Math.min(100, Math.round((waitedMs / thresholdMs) * 100));

  /*
    Two answers to the same question, and both are trusted.

    `escalationFired` is the server's own decision, taken against the server's
    clock at the moment of the read. The subtraction below is this tab's clock,
    which keeps running after that. Either one saying "fired" is enough: a
    countdown that ticks to zero and then claims there is still time left is
    the one failure a shop owner would never forgive.
  */
  const fired = thread.escalationFired || waitedMs >= thresholdMs;
  if (fired) {
    return {
      stage: "escalated",
      waitedMs,
      minutesLeft: null,
      percent: 100,
      thresholdMinutes,
    };
  }

  return {
    stage: "waiting",
    waitedMs,
    // Rounded UP, and never below one: "escalates in 0 min" reads as though it
    // already has.
    minutesLeft: Math.max(1, Math.ceil((thresholdMs - waitedMs) / MINUTE)),
    percent,
    thresholdMinutes,
  };
}

/**
 * "12 min" / "2 h" for a number of minutes still to run.
 *
 * The same two phrases `waitedLabel` uses, so a countdown and an elapsed time
 * never read in two different vocabularies on one row. The threshold is a
 * platform setting and may legitimately be hours, so this does not assume
 * minutes will do.
 */
export function remainingLabel(
  minutes: number | null,
  t: { brand: { waitedMinutes: string; waitedHours: string } }
): string | null {
  if (minutes === null || minutes < 0) return null;
  if (minutes >= 60) {
    return t.brand.waitedHours.replace("{n}", String(Math.floor(minutes / 60)));
  }
  return t.brand.waitedMinutes.replace("{n}", String(minutes));
}

/**
 * The shopper who has waited longest, first.
 *
 * `byLongestWait` in @/lib/waited ranks on a field called `waitingSince`, and a
 * thread's clock is `oldestUnansweredMessageAt` — the same idea under another
 * name — so the ordering is done here rather than by renaming a wire field into
 * a shape it does not have. Threads with no clock running fall to the bottom,
 * newest conversation first.
 */
export function byLongestUnanswered(
  threads: readonly BrandThread[],
  now: number = Date.now()
): BrandThread[] {
  return [...threads].sort((a, b) => {
    const waitA = waitedFor(a.oldestUnansweredMessageAt, now);
    const waitB = waitedFor(b.oldestUnansweredMessageAt, now);
    if (waitA !== waitB) return waitB - waitA;
    const lastA = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const lastB = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return lastB - lastA;
  });
}

/** The one thread worth putting under a thumb: the longest wait still running. */
export function longestWaiting(
  threads: readonly BrandThread[],
  now: number = Date.now()
): BrandThread | null {
  const ranked = byLongestUnanswered(threads, now);
  const first = ranked[0];
  if (!first) return null;
  return waitedFor(first.oldestUnansweredMessageAt, now) >= 0 ? first : null;
}

/**
 * The last message a brand should mark read on opening a thread — the newest
 * one, and only when it came from the shopper's side and is still unread.
 *
 * Marking read has a CONSEQUENCE beyond a tick: `Message.readAt` is the same
 * column the unanswered fall-through tests, so reading a thread stops the
 * countdown to WhatsApp even if nothing is typed back. The screen says so out
 * loud rather than letting a shop owner discover it.
 */
export function unreadUpTo(messages: readonly ChatMessage[]): string | null {
  const last = messages[messages.length - 1];
  if (!last) return null;
  const shopperSide =
    last.senderType === "SHOPPER" || last.senderType === "GUEST";
  return shopperSide && last.readAt === null ? last.id : null;
}
