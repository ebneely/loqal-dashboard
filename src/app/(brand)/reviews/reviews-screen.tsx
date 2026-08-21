"use client";

/**
 * /reviews — what shoppers said, and what the shop has earned.
 *
 * Composed from the domain layer: ListState, MobileActionBar — plus shadcn's
 * Tabs, Card, Badge, Progress, Textarea, Button and Separator.
 *
 * Three rules run through this screen, and all three are about the difference
 * between information and advertising:
 *
 *  a. COMPUTED AND VERIFIED BADGES ARE NEVER THE SAME OBJECT. They live under
 *     two headings, in two visually distinct cards, and no figure adds them up.
 *     One is arithmetic over delivered orders; the other is a person at Loqal
 *     saying they checked something on a date. A single count would let the
 *     second hide inside the first.
 *
 *  b. NOTHING HERE CAN SWITCH A COMPUTED BADGE ON. There is no control, no
 *     disabled control, and no wording that implies one exists — a greyed
 *     button still invites the argument. A badge that could be enabled is
 *     advertising, and the day one is, every badge on the site is.
 *
 *  c. `reputationScore` IS NOT ON THIS SCREEN. Loqal's private 0–100 judgement
 *     is SUPER_ADMIN's; the brand plane does not send it and the parse boundary
 *     in reputation-wire.ts strips it if it ever reappears.
 */
import { BadgeCheckIcon, LockIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { ComputedBadgeType } from "@loqal/contracts/enums";

import {
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
  listStateFor,
} from "@/components/loqal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/lib/locale-context";
import type { Messages } from "@/messages";
import { waitedLabel } from "@/lib/waited";

import {
  useBrandBadges,
  useBrandReputation,
  useReviewReply,
} from "./reputation-data";
import {
  badgeProgressPercent,
  badgeStanding,
  formatBadgeValue,
  isoDay,
  newestFirst,
  oldestUnanswered,
  orderedComputed,
  type ComputedBadge,
  type Review,
} from "./reputation-wire";

const MAX_RATING = 5;

function Stars({ rating, label }: { rating: number; label: string }) {
  const filled = Math.max(0, Math.min(MAX_RATING, rating));
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-center gap-0.5 text-state-good-fg"
    >
      {Array.from({ length: MAX_RATING }).map((_, index) => (
        <StarIcon
          key={index}
          aria-hidden="true"
          className={index < filled ? "size-4 fill-current" : "size-4 opacity-30"}
        />
      ))}
    </span>
  );
}

function ReviewCard({
  review,
  t,
  now,
  onReplied,
}: {
  review: Review;
  t: Messages;
  now: number;
  /** The reply endpoint's answer, handed back to the list that owns the row. */
  onReplied: (review: Review) => void;
}) {
  const b = t.brand;
  const { reply, pendingId, failedId } = useReviewReply();
  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState(false);

  const ago = waitedLabel(review.createdAt, t, now);
  const pending = pendingId === review.id;
  const failed = failedId === review.id;

  const onReply = async () => {
    if (!draft.trim()) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    const next = await reply(review.id, draft);
    if (next) {
      onReplied(next);
      setDraft("");
    }
  };

  return (
    <Card className="" data-testid={`review-${review.id}`}>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Stars
            rating={review.rating}
            label={b.ratingOf.replace("{n}", String(review.rating))}
          />
          <span className="text-xs text-muted-foreground">
            {ago ? b.chatLastMessageAgo.replace("{t}", ago) : null}
            {review.editedAt ? ` · ${b.reviewEdited}` : null}
          </span>
        </div>

        <p className="text-sm text-foreground">
          {review.body ?? (
            <span className="text-muted-foreground">{b.reviewNoBody}</span>
          )}
        </p>

        {review.hiddenAt ? (
          <div className="grid gap-1 rounded-md border border-state-bad-border bg-state-bad-bg px-3 py-2">
            <span className="text-xs font-medium text-state-bad-fg">
              {b.reviewHidden}
            </span>
            {review.hiddenReason ? (
              <span className="text-xs text-muted-foreground">
                {b.reviewHiddenReason}: {review.hiddenReason}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {b.reviewHiddenNote}
            </span>
          </div>
        ) : null}

        <Separator />

        {review.brandReply ? (
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {b.yourReply}
            </span>
            <p className="text-sm text-foreground">{review.brandReply}</p>
          </div>
        ) : (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onReply();
            }}
          >
            <label
              htmlFor={`reply-${review.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              {b.yourReply}
            </label>
            <Textarea
              id={`reply-${review.id}`}
              rows={2}
              placeholder={b.replyPlaceholder}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (event.target.value.trim()) setBlocked(false);
              }}
            />
            <p className="text-xs text-muted-foreground">{b.replyOnce}</p>
            <Button
              type="submit"
              size="sm"
              className="min-h-11 justify-self-start"
              disabled={pending}
            >
              {pending ? b.saving : b.replySend}
            </Button>
            {blocked ? (
              <p className="text-xs text-state-bad-fg" role="alert">
                {b.replyRequired}
              </p>
            ) : null}
            {failed ? (
              <p className="text-xs text-state-bad-fg" role="alert">
                {b.replyFailed}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ComputedBadgeCard({
  badge,
  t,
}: {
  badge: ComputedBadge;
  t: Messages;
}) {
  const b = t.brand;
  const standing = badgeStanding(badge);
  const percent = badgeProgressPercent(badge);
  const type = badge.type as ComputedBadgeType;

  const value =
    badge.currentValue === null
      ? null
      : formatBadgeValue(type, badge.currentValue, {
          unitPercent: b.unitPercent,
          waitedMinutes: b.waitedMinutes,
        });
  const target = formatBadgeValue(type, badge.targetValue, {
    unitPercent: b.unitPercent,
    waitedMinutes: b.waitedMinutes,
  });

  /**
   * Progress, never a bare "not earned". A shop that is two orders short can
   * do something about it; a shop told only that it failed cannot.
   */
  const measurement =
    badge.ordersNeeded > 0
      ? b.badgeSampleNeeded.replace("{n}", String(badge.ordersNeeded))
      : value === null
        ? b.badgeNoMeasurement
        : (badge.direction === "AT_LEAST" ? b.badgeAtLeast : b.badgeAtMost)
            .replace("{current}", value)
            .replace("{target}", target);

  const earnedOn = isoDay(badge.earnedAt);

  return (
    <Card
      className=""
      data-testid={`computed-badge-${badge.type}`}
      data-standing={standing}
    >
      <CardHeader className="gap-1">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {b.badgeName[type]}
          {badge.earned ? (
            <Badge variant="secondary">{b.badgeEarned}</Badge>
          ) : (
            <Badge variant="outline">{b.badgeNotEarned}</Badge>
          )}
        </CardTitle>
        <CardDescription>{b.badgeWhat[type]}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Progress value={percent} aria-label={b.badgeName[type]} />
        <p className="text-sm text-foreground">{measurement}</p>
        <p className="text-xs text-muted-foreground">
          {b.badgeSampleReady.replace("{n}", String(badge.ordersInWindow))}
        </p>

        {/*
          `earned` is the nightly job's answer and `qualifies` is today's. They
          can disagree for a window, and both are shown — hiding one to make the
          card tidy is how a shop ends up arguing about a badge nobody can
          explain.
        */}
        {standing === "slipping" ? (
          <p className="text-xs text-state-bad-fg" data-testid="badge-slipping">
            {b.badgeSlipping}
          </p>
        ) : null}
        {standing === "pending" ? (
          <p className="text-xs text-muted-foreground" data-testid="badge-pending">
            {b.badgePending}
          </p>
        ) : null}
        {earnedOn ? (
          <p className="text-xs text-muted-foreground">
            {b.badgeEarnedOn} {earnedOn}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReviewsScreen() {
  const t = useMessages();
  const b = t.brand;

  const reputation = useBrandReputation();
  const badges = useBrandBadges();

  const now = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reputation.reviews]
  );

  const reviews = useMemo(
    () => newestFirst(reputation.reviews),
    [reputation.reviews]
  );
  const nextToAnswer = useMemo(() => oldestUnanswered(reviews), [reviews]);

  const reviewState = listStateFor(reputation.error, {
    isLoading: reputation.isLoading,
    isEmpty: reviews.length === 0,
  });

  const badgeState = listStateFor(badges.error, {
    isLoading: badges.isLoading,
    isEmpty: false,
  });

  const computed = orderedComputed(badges.data?.computed ?? []);
  const verified = badges.data?.verified ?? [];

  return (
    <div className="grid gap-4">
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">{b.reviewsTabReviews}</TabsTrigger>
          <TabsTrigger value="badges">{b.reviewsTabBadges}</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="grid gap-3">
          <p className="text-sm text-muted-foreground">{b.reviewsNote}</p>

          {reviewState === "loading" ? (
            <ListState state="loading" rows={3} />
          ) : null}

          {reviewState === "error" ? (
            <ListState
              state="error"
              title={b.reviewsErrorTitle}
              body={b.errorBody}
              actionLabel={b.retry}
              onAction={reputation.reload}
            />
          ) : null}

          {reviewState === "denied" ? (
            <ListState
              state="denied"
              title={b.reviewsOnlyTitle}
              body={b.reviewsOnlyBody}
              requiredRole="BRAND_OWNER"
            />
          ) : null}

          {reviewState === "empty" ? (
            <ListState
              state="empty"
              title={b.reviewsEmptyTitle}
              body={b.reviewsEmptyBody}
            />
          ) : null}

          {reviewState === null
            ? reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  t={t}
                  now={now}
                  onReplied={reputation.applyReview}
                />
              ))
            : null}
        </TabsContent>

        <TabsContent value="badges" className="grid gap-4">
          {badgeState === "loading" ? (
            <ListState state="loading" rows={3} />
          ) : null}

          {badgeState === "error" ? (
            <ListState
              state="error"
              title={b.badgesErrorTitle}
              body={b.errorBody}
              actionLabel={b.retry}
              onAction={badges.reload}
            />
          ) : null}

          {badgeState === "denied" ? (
            <ListState
              state="denied"
              title={b.reviewsOnlyTitle}
              body={b.reviewsOnlyBody}
              requiredRole="BRAND_OWNER"
            />
          ) : null}

          {badgeState === null ? (
            <>
              <section aria-label={b.badgesComputedTitle} className="grid gap-3">
                <div className="grid gap-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <LockIcon aria-hidden="true" className="size-4" />
                    {b.badgesComputedTitle}
                  </h2>
                  {/*
                    The sentence that has to survive every redesign of this
                    screen: nobody can switch one on.
                  */}
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="computed-not-grantable"
                  >
                    {b.badgesComputedNote}
                  </p>
                </div>
                {computed.map((badge) => (
                  <ComputedBadgeCard key={badge.type} badge={badge} t={t} />
                ))}
              </section>

              <section aria-label={b.badgesVerifiedTitle} className="grid gap-3">
                <div className="grid gap-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <BadgeCheckIcon aria-hidden="true" className="size-4" />
                    {b.badgesVerifiedTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {b.badgesVerifiedNote}
                  </p>
                </div>

                {verified.length === 0 ? (
                  <ListState
                    state="empty"
                    title={b.badgesVerifiedNoneTitle}
                    body={b.badgesVerifiedNoneBody}
                  />
                ) : (
                  verified.map((badge) => (
                    <Card
                      key={badge.id}
                      /* Visually distinct from a computed card on purpose: a
                         filled accent border, never the same neutral surface. */
                      className="border-primary/40 bg-primary/5"
                      data-testid={`verified-badge-${badge.id}`}
                    >
                      <CardHeader className="gap-1">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                          <BadgeCheckIcon aria-hidden="true" className="size-4" />
                          {b.verifiedName[badge.type]}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-1 text-xs text-muted-foreground">
                        <span>
                          {b.badgeCheckedAgainst}: {badge.checkedAgainst}
                        </span>
                        <span>
                          {b.badgeCheckedOn} {isoDay(badge.checkedAt)}
                        </span>
                        <span>
                          {b.badgeExpires} {isoDay(badge.expiresAt)}
                        </span>
                      </CardContent>
                    </Card>
                  ))
                )}
              </section>

              {/*
                Paid placement, labelled as bought. It rides on this plane's
                reputation payload and is never a badge — selling placement is
                fine, selling the appearance of trust is not.
              */}
              {reputation.data ? (
                <Card className="" data-testid="placement">
                  <CardHeader className="gap-1">
                    <CardTitle className="text-base">
                      {b.placementTitle}
                    </CardTitle>
                    <CardDescription>
                      {reputation.data.isPromoted
                        ? b.placementOn
                        : b.placementOff}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-1 text-xs text-muted-foreground">
                    <span>{b.placementNote}</span>
                    {reputation.data.featuredUntil ? (
                      <span>
                        {b.placementUntil}{" "}
                        {isoDay(reputation.data.featuredUntil)}
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      {nextToAnswer ? (
        <>
          <MobileActionBar hint={b.replyOldestHint}>
            <span className="block" data-testid="reviews-action-bar">
              <Button asChild className="min-h-14 w-full text-base">
                <a href={`#reply-${nextToAnswer.id}`}>{b.replyOldest}</a>
              </Button>
            </span>
          </MobileActionBar>
          <MobileActionBarSpacer />
        </>
      ) : null}
    </div>
  );
}
