/**
 * Chat fixtures.
 *
 * Every row here is shaped against the SHIPPED API rather than against the
 * design mockup — a raw `Thread` enriched with the three countdown fields
 * `ChatService.listThreadsForBrand` adds, and a raw `Message` with its
 * attachment join rows. No names, no addresses and no phone numbers appear,
 * because the API carries none: a fixture that invented one would make the
 * screen look finished and hide the gap it is built around.
 */
import type { BrandThread, ChatMessage } from "../chat-wire";

/** One clock for every fixture in this folder. */
export const NOW = new Date("2026-08-14T12:00:00.000Z");

const minutesAgo = (n: number) =>
  new Date(NOW.getTime() - n * 60_000).toISOString();

const THRESHOLD = 30;

/** A guest, 22 minutes into a 30-minute countdown. Eight minutes left. */
export const waitingThread: BrandThread = {
  id: "0199b000-0000-7000-8000-000000000001",
  customerId: null,
  guestId: "0199c000-0000-7000-8000-000000000001",
  brandId: "0199a000-0000-7000-8000-0000000000aa",
  lastMessageAt: minutesAgo(22),
  createdAt: minutesAgo(400),
  oldestUnansweredMessageAt: minutesAgo(22),
  unansweredThresholdMinutes: THRESHOLD,
  escalationFired: false,
};

/** A registered shopper, past the threshold. Already passed to WhatsApp. */
export const escalatedThread: BrandThread = {
  id: "0199b000-0000-7000-8000-000000000002",
  customerId: "0199d000-0000-7000-8000-000000000002",
  guestId: null,
  brandId: "0199a000-0000-7000-8000-0000000000aa",
  lastMessageAt: minutesAgo(45),
  createdAt: minutesAgo(900),
  oldestUnansweredMessageAt: minutesAgo(45),
  unansweredThresholdMinutes: THRESHOLD,
  escalationFired: true,
};

/** Answered: no clock is running at all. */
export const quietThread: BrandThread = {
  id: "0199b000-0000-7000-8000-000000000003",
  customerId: "0199d000-0000-7000-8000-000000000003",
  guestId: null,
  brandId: "0199a000-0000-7000-8000-0000000000aa",
  lastMessageAt: minutesAgo(180),
  createdAt: minutesAgo(2000),
  oldestUnansweredMessageAt: null,
  unansweredThresholdMinutes: THRESHOLD,
  escalationFired: false,
};

/**
 * Deliberately NOT in wait order — the screen is what ranks them, and a fixture
 * that arrived pre-sorted would let a broken sort pass.
 */
export const threadList: BrandThread[] = [
  quietThread,
  waitingThread,
  escalatedThread,
];

export const emptyThreadList: BrandThread[] = [];

export const shopperMessage: ChatMessage = {
  id: "0199e000-0000-7000-8000-000000000001",
  threadId: waitingThread.id,
  senderType: "GUEST",
  senderId: null,
  body: "Do you have this in a larger size?",
  readAt: null,
  createdAt: minutesAgo(22),
  attachments: [],
};

export const brandMessage: ChatMessage = {
  id: "0199e000-0000-7000-8000-000000000002",
  threadId: waitingThread.id,
  senderType: "BRAND",
  senderId: "0199f000-0000-7000-8000-000000000001",
  body: "Checking the shelf now.",
  readAt: null,
  createdAt: minutesAgo(20),
  attachments: [],
};

/** A shopper's photo. The API serves an id and no address for it. */
export const messageWithAttachment: ChatMessage = {
  id: "0199e000-0000-7000-8000-000000000003",
  threadId: waitingThread.id,
  senderType: "GUEST",
  senderId: null,
  body: "This is the one I mean.",
  readAt: null,
  createdAt: minutesAgo(5),
  attachments: [{ mediaId: "0199aa00-0000-7000-8000-000000000001" }],
};

export const threadMessages: ChatMessage[] = [
  shopperMessage,
  brandMessage,
  messageWithAttachment,
];

export const sentMessage: ChatMessage = {
  id: "0199e000-0000-7000-8000-000000000009",
  threadId: waitingThread.id,
  senderType: "BRAND",
  senderId: "0199f000-0000-7000-8000-000000000001",
  body: "Yes, we have it.",
  readAt: null,
  createdAt: minutesAgo(0),
  attachments: [],
};
