/**
 * The asymmetry between how platform settings are READ and how they are
 * WRITTEN, handled in one place.
 *
 * The read is GROUPED — analytics, sales, try-on, chat, badges — so that twenty
 * unrelated numbers are not a flat wall somebody changes the wrong row of. The
 * write is FLAT, a single bag of optional keys, so a PATCH names exactly what
 * it touched. That is the API's shape, not a slip here, and the two halves meet
 * in this file rather than in the middle of a component.
 *
 * NO REACT AND NO FETCH BELOW. Every rule here is about which twenty values
 * changed and which of them may legally be sent, which is exactly the thing
 * worth testing without a DOM.
 */
import {
  updatePlatformSettingsBodySchema,
  type PlatformSettings,
  type UpdatePlatformSettingsBody,
} from "@loqal/contracts/admin.contract";

/**
 * Every key, flattened, as the STRING an input holds.
 *
 * Strings rather than numbers throughout, because an input mid-edit is
 * legitimately "" or "1" on the way to "10", and a number-typed model would
 * have to represent both of those as NaN or 1 and lose the difference. The
 * conversion happens once, in `diffSettings`, where a refusal is possible.
 */
export type SettingsForm = {
  analyticsTimezone: string;
  analyticsKAnonymityFloor: string;
  ingestRejectRetentionDays: string;
  defaultFreeMonths: string;
  salesCommissionFloorBps: string;
  salesMaxFreeMonths: string;
  tryOnModelId: string;
  tryOnFallbackModelId: string;
  tryOnMonthlyBudgetCents: string;
  tryOnAccountLifetimeCap: string;
  chatAttachmentMaxBytes: string;
  chatAttachmentAllowedMimeTypes: string;
  guestThreadLifetimeDays: string;
  chatUnansweredThresholdMinutes: string;
  badgeMinOrderCount: string;
  badgeWindowDays: string;
  badgeSameDayShareBpsThreshold: string;
  badgeFastConfirmMinutesThreshold: string;
  badgeCancellationRateBpsMax: string;
};

export type SettingsField = keyof SettingsForm;

/**
 * Two keys are NULLABLE on the wire and neither is "zero".
 *
 * `salesCommissionFloorBps: null` means no floor has been fixed while the first
 * brands are being signed — a sales rep may agree anything. `0` would mean a
 * floor of zero per cent, which is a different promise. Same for
 * `salesMaxFreeMonths`. So an empty input round-trips to null and never to 0.
 */
export const NULLABLE_FIELDS: readonly SettingsField[] = [
  "salesCommissionFloorBps",
  "salesMaxFreeMonths",
];

/** Everything that is not a number or a list. */
export const TEXT_FIELDS: readonly SettingsField[] = [
  "analyticsTimezone",
  "tryOnModelId",
  "tryOnFallbackModelId",
  "chatAttachmentAllowedMimeTypes",
];

export function formFrom(settings: PlatformSettings): SettingsForm {
  const nullable = (value: number | null) => (value === null ? "" : String(value));

  return {
    analyticsTimezone: settings.analytics.analyticsTimezone,
    analyticsKAnonymityFloor: String(settings.analytics.analyticsKAnonymityFloor),
    ingestRejectRetentionDays: String(
      settings.analytics.ingestRejectRetentionDays
    ),
    defaultFreeMonths: String(settings.sales.defaultFreeMonths),
    salesCommissionFloorBps: nullable(settings.sales.salesCommissionFloorBps),
    salesMaxFreeMonths: nullable(settings.sales.salesMaxFreeMonths),
    tryOnModelId: settings.tryOn.tryOnModelId,
    tryOnFallbackModelId: settings.tryOn.tryOnFallbackModelId,
    tryOnMonthlyBudgetCents: String(settings.tryOn.tryOnMonthlyBudgetCents),
    tryOnAccountLifetimeCap: String(settings.tryOn.tryOnAccountLifetimeCap),
    chatAttachmentMaxBytes: String(settings.chat.chatAttachmentMaxBytes),
    /* Comma separated, because a list of four mime types is a line of text and
       a chip editor for it would be more machinery than the value deserves. */
    chatAttachmentAllowedMimeTypes:
      settings.chat.chatAttachmentAllowedMimeTypes.join(", "),
    guestThreadLifetimeDays: String(settings.chat.guestThreadLifetimeDays),
    chatUnansweredThresholdMinutes: String(
      settings.chat.chatUnansweredThresholdMinutes
    ),
    badgeMinOrderCount: String(settings.badges.badgeMinOrderCount),
    badgeWindowDays: String(settings.badges.badgeWindowDays),
    badgeSameDayShareBpsThreshold: String(
      settings.badges.badgeSameDayShareBpsThreshold
    ),
    badgeFastConfirmMinutesThreshold: String(
      settings.badges.badgeFastConfirmMinutesThreshold
    ),
    badgeCancellationRateBpsMax: String(
      settings.badges.badgeCancellationRateBpsMax
    ),
  };
}

export type SettingsDiff = {
  /** Only the keys whose values differ. Empty when nothing changed. */
  changed: readonly SettingsField[];
  /** The PATCH body, or null when it would not be accepted. */
  body: UpdatePlatformSettingsBody | null;
  /** Fields holding something that is not a legal value for them. */
  invalid: readonly SettingsField[];
  /**
   * True when the timezone was edited. It is a legal KEY and an illegal
   * CHANGE — see `timezoneIsRefused`.
   */
  timezoneEdited: boolean;
};

/**
 * What would actually be sent.
 *
 * A key the admin did not touch is not in the body at all. That is not an
 * optimisation: it is what lets a change somebody else made in the meantime
 * survive this save instead of being overwritten with whatever happened to be
 * on this screen when it loaded.
 *
 * `analyticsTimezone` is dropped from the body even when it differs. Day
 * boundaries are baked into every analytics row at the moment it is written, so
 * every day already recorded was computed under the current value; sending a
 * different one is a 422 at the API, and it would not recompute anything even
 * if it were accepted — it would silently mean two different things in one
 * table. The screen reports the refusal rather than letting the request fail.
 */
export function diffSettings(
  original: PlatformSettings,
  form: SettingsForm
): SettingsDiff {
  const baseline = formFrom(original);
  const changed: SettingsField[] = [];
  const invalid: SettingsField[] = [];
  const body: Record<string, unknown> = {};

  for (const key of Object.keys(baseline) as SettingsField[]) {
    if (form[key] === baseline[key]) continue;
    changed.push(key);

    if (key === "analyticsTimezone") continue; // Reported, never sent.

    if (key === "chatAttachmentAllowedMimeTypes") {
      const types = form[key]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (types.length === 0) invalid.push(key);
      else body[key] = types;
      continue;
    }

    if (TEXT_FIELDS.includes(key)) {
      if (form[key].trim() === "") invalid.push(key);
      else body[key] = form[key].trim();
      continue;
    }

    if (NULLABLE_FIELDS.includes(key) && form[key].trim() === "") {
      // Empty means "no floor set", which is null and is NOT zero.
      body[key] = null;
      continue;
    }

    const value = wholeNumber(form[key]);
    if (value === null) invalid.push(key);
    else body[key] = value;
  }

  const timezoneEdited = changed.includes("analyticsTimezone");

  if (invalid.length > 0 || Object.keys(body).length === 0) {
    return { changed, body: null, invalid, timezoneEdited };
  }

  /**
   * Parsed against the contract before it leaves. A k-anonymity floor of 0 or a
   * commission floor of 20000 bps is refused HERE with a sentence beside the
   * field, rather than there with a 400 an admin has to decode.
   */
  const parsed = updatePlatformSettingsBodySchema.safeParse(body);
  if (!parsed.success) {
    const rejected = parsed.error.issues
      .map((issue) => issue.path[0])
      .filter((path): path is SettingsField => typeof path === "string");
    return {
      changed,
      body: null,
      invalid: [...new Set([...invalid, ...rejected])],
      timezoneEdited,
    };
  }

  return { changed, body: parsed.data, invalid, timezoneEdited };
}

/** The timezone is read-only in practice. Named so the screen can say why. */
export const timezoneIsRefused = (diff: SettingsDiff): boolean =>
  diff.timezoneEdited;

function wholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
