"use client";

/**
 * /chat/[threadId] — one conversation, and a box to answer it from.
 *
 * Composed from shadcn's message / bubble / message-scroller / attachment
 * components — the exact surface they exist for — plus the domain layer's
 * ListState and MobileActionBar.
 *
 * PRESENCE IS NOT RENDERED, and that is the point rather than an omission.
 * The asymmetry is deliberate on the backend: a shopper may learn whether a
 * brand is online, a brand may learn only that somebody is in THIS thread right
 * now, and `PresenceService` has no method that could answer "is this shopper
 * online" at all. On this plane even that much is unreachable — presence rides
 * the chat WebSocket gateway and there is no REST route and no socket client in
 * this app — so the screen renders nothing about it. A roster of who is
 * browsing is exactly what must never appear here, and the safest way to keep
 * that true is to render only what the API answered with.
 *
 * ATTACHMENTS ARE READ, NOT SENT. `sendMessageSchema` takes
 * `attachmentMediaIds` and the media upload flow lives in another route folder;
 * the screen says so rather than pretending the paperclip is coming.
 */
import { ArrowDownIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
  listStateFor,
} from "@/components/loqal";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/lib/locale-context";
import { waitedLabel } from "@/lib/waited";

import { useMarkRead, useSendMessage, useThreadMessages } from "../chat-data";
import { unreadUpTo, type ChatMessage } from "../chat-wire";

export function ThreadView({ threadId }: { threadId: string }) {
  const t = useMessages();
  const b = t.brand;

  const thread = useThreadMessages(threadId);
  const sender = useSendMessage(threadId);

  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState(false);

  const now = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thread.messages]
  );

  /*
    Reading the thread stops the clock. `Message.readAt` is the same column the
    unanswered fall-through tests, so opening this cancels the hand-off to
    WhatsApp whether or not anything is typed back — which is why the note below
    is on screen rather than in this comment only.
  */
  const upTo = useMemo(() => unreadUpTo(thread.messages), [thread.messages]);
  const wasWaiting = upTo !== null;
  useMarkRead(threadId, upTo);

  const state = listStateFor(thread.error, {
    isLoading: thread.isLoading,
    isEmpty: thread.messages.length === 0,
    notFound: true,
  });

  const senderLabel = (message: ChatMessage) => {
    switch (message.senderType) {
      case "BRAND":
        return b.senderBrand;
      case "ADMIN":
        return b.senderAdmin;
      case "GUEST":
        return b.senderGuest;
      default:
        return b.senderShopper;
    }
  };

  const onSend = async () => {
    if (!draft.trim()) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    const posted = await sender.send(draft);
    if (posted) {
      thread.append(posted);
      setDraft("");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <Link href="/chat">{b.threadBack}</Link>
        </Button>
      </div>

      {wasWaiting ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="thread-read-note"
        >
          {b.threadReadStopsClock}
        </p>
      ) : null}

      <section aria-label={b.threadTitle} className="grid gap-3">
        {state === "loading" ? <ListState state="loading" rows={3} /> : null}

        {state === "error" ? (
          <ListState
            state="error"
            title={b.threadErrorTitle}
            body={b.errorBody}
            actionLabel={b.retry}
            onAction={thread.reload}
          />
        ) : null}

        {state === "denied" ? (
          <ListState
            state="denied"
            title={b.chatOnlyTitle}
            body={b.chatOnlyBody}
            requiredRole="BRAND_OWNER"
          />
        ) : null}

        {/*
          No `actionHref` here, deliberately. The way out of this dead end is
          the back link at the top of the screen, one element above the panel —
          adding a second anchor with the same accessible name is the exact
          accessibility bug `hideAt="never"` exists to remove elsewhere.
        */}
        {state === "notFound" ? (
          <ListState
            state="notFound"
            title={b.threadNotFoundTitle}
            body={b.threadNotFoundBody}
          />
        ) : null}

        {state === "empty" ? (
          <ListState
            state="empty"
            title={b.threadEmptyTitle}
            body={b.threadEmptyBody}
          />
        ) : null}

        {state === null ? (
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller className="h-[55svh] md:h-[60svh]">
              <MessageScrollerViewport aria-label={b.threadMessages}>
                <MessageScrollerContent className="gap-4 p-1">
                  {thread.messages.map((message) => {
                    const ours = message.senderType === "BRAND";
                    const elapsed = waitedLabel(message.createdAt, t, now);
                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                      >
                        <Message align={ours ? "end" : "start"}>
                          <MessageContent>
                            <MessageHeader>{senderLabel(message)}</MessageHeader>
                            <Bubble
                              variant={ours ? "default" : "muted"}
                              align={ours ? "end" : "start"}
                            >
                              <BubbleContent>{message.body}</BubbleContent>
                            </Bubble>
                            {message.attachments.length > 0 ? (
                              <AttachmentGroup>
                                {message.attachments.map((attachment) => (
                                  <Attachment
                                    key={attachment.mediaId}
                                    size="sm"
                                    state="done"
                                  >
                                    <AttachmentMedia>
                                      <PaperclipIcon />
                                    </AttachmentMedia>
                                    <AttachmentContent>
                                      <AttachmentTitle>
                                        {b.attachmentLabel}
                                      </AttachmentTitle>
                                      {/* No URL exists for a media id on this
                                          plane, so it is shown to exist and
                                          never dressed up as openable. */}
                                      <AttachmentDescription>
                                        {b.attachmentNoAddress}
                                      </AttachmentDescription>
                                    </AttachmentContent>
                                  </Attachment>
                                ))}
                              </AttachmentGroup>
                            ) : null}
                            <MessageFooter>
                              {elapsed
                                ? b.chatLastMessageAgo.replace("{t}", elapsed)
                                : null}
                              {message.readAt ? ` · ${b.messageRead}` : null}
                            </MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton>
                <ArrowDownIcon />
                <span className="sr-only">{b.threadScrollLatest}</span>
              </MessageScrollerButton>
            </MessageScroller>
          </MessageScrollerProvider>
        ) : null}
      </section>

      {/*
        The composer is the primary action of this screen at every width, so it
        is one control in the tree rather than a phone copy and a desktop copy —
        two nodes with the same accessible name is the bug `hideAt="never"`
        exists to remove.
      */}
      {state === "loading" || state === "denied" || state === "notFound" ? null : (
        <>
          <MobileActionBar hideAt="never" hint={b.attachSendUnavailable}>
            <form
              className="grid w-full gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onSend();
              }}
            >
              <label
                htmlFor="chat-reply"
                className="text-sm font-medium text-foreground"
              >
                {b.typeHere}
              </label>
              <Textarea
                id="chat-reply"
                rows={2}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (event.target.value.trim()) setBlocked(false);
                }}
              />
              <Button
                type="submit"
                className="min-h-11 w-full md:w-auto md:justify-self-start"
                disabled={sender.pending}
              >
                {sender.pending ? b.sending : b.send}
              </Button>
              {blocked ? (
                <p className="text-xs text-state-bad-fg" role="alert">
                  {b.messageRequired}
                </p>
              ) : null}
              {sender.failed ? (
                <p className="text-xs text-state-bad-fg" role="alert">
                  {b.sendFailed}
                </p>
              ) : null}
            </form>
          </MobileActionBar>
          <MobileActionBarSpacer hideAt="never" />
        </>
      )}
    </div>
  );
}
