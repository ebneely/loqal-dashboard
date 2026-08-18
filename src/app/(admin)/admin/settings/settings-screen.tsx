"use client";

/**
 * /admin/settings — one database row, grouped by what each setting governs.
 *
 * Composed from the domain layer: ListState — plus shadcn's Alert, Button,
 * Card, Input and Separator.
 *
 * GROUPED ON READ, FLAT ON WRITE. The read is grouped so nobody changes the
 * wrong number out of twenty unrelated ones; the save names only the keys whose
 * values actually differ, so a change somebody else made in the meantime
 * survives this save rather than being silently overwritten. See
 * `settings-form.ts` — that asymmetry is the API's own and is handled once.
 *
 * THE TIMEZONE IS READ-ONLY AND THE REASON IS NOT ARBITRARY. Day boundaries are
 * baked into every analytics row at the moment it is written, so every day
 * already recorded was computed under this value. Changing it would not
 * recompute them; it would silently mean two different things in one table. The
 * field is shown, editable, and refused with the reason — a disabled input with
 * no explanation reads as a bug.
 *
 * BASIS POINTS ARE LABELLED AS BASIS POINTS. Three fields here are bps and one
 * of them is a commission floor a sales rep is held to; "100" meaning one per
 * cent is exactly the kind of unit that gets entered as 100 per cent once.
 */
import { useEffect, useState } from "react";

import { ListState, listStateFor } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import { savePlatformSettings, usePlatformSettings } from "./settings-data";
import {
  diffSettings,
  formFrom,
  timezoneIsRefused,
  type SettingsField,
  type SettingsForm,
} from "./settings-form";

type Row = { field: SettingsField; label: string; unit?: string; hint?: string };

export function SettingsScreen() {
  const t = useMessages();
  const a = t.admin;

  const settings = usePlatformSettings();

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [outcome, setOutcome] = useState<"saved" | "failed" | null>(null);

  useEffect(() => {
    if (settings.data) setForm(formFrom(settings.data));
  }, [settings.data]);

  const state = listStateFor(settings.error, {
    isLoading: settings.isLoading,
    notFound: true,
  });

  /**
   * The failure states are checked BEFORE the `!form` guard, deliberately.
   *
   * `form` is seeded from the response, so it stays null on a 403 forever — and
   * a `!form` guard placed first would draw the loading skeleton over a
   * permission denial for the rest of the session, which reads as a hung screen
   * rather than as a refusal.
   */
  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={a.deniedTitle}
        body={a.deniedBody}
        requiredRole={ADMIN_REQUIRED_ROLE}
      />
    );
  }

  if (state === "notFound") {
    return <ListState state="notFound" title={a.settingsNotFound} />;
  }

  if (state === "error") {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={settings.reload}
      />
    );
  }

  if (state === "loading" || !form || !settings.data) {
    return <ListState state="loading" rows={4} />;
  }

  const diff = diffSettings(settings.data, form);
  const refusedTimezone = timezoneIsRefused(diff);

  const set = (field: SettingsField, value: string) =>
    setForm((current) => (current ? { ...current, [field]: value } : current));

  const save = async () => {
    if (!diff.body) return;
    setOutcome(null);
    try {
      await savePlatformSettings(diff.body);
      setOutcome("saved");
      settings.reload();
    } catch {
      setOutcome("failed");
    }
  };

  const groups: { title: string; note: string; rows: readonly Row[] }[] = [
    {
      title: a.groupAnalytics,
      note: a.groupAnalyticsNote,
      rows: [
        { field: "analyticsTimezone", label: a.fieldAnalyticsTimezone },
        {
          field: "analyticsKAnonymityFloor",
          label: a.fieldKAnonymity,
          unit: a.unitBrands,
        },
        {
          field: "ingestRejectRetentionDays",
          label: a.fieldIngestRetention,
          unit: a.unitDays,
        },
      ],
    },
    {
      title: a.groupSales,
      note: a.groupSalesNote,
      rows: [
        {
          field: "defaultFreeMonths",
          label: a.fieldDefaultFreeMonths,
          unit: a.unitMonths,
        },
        {
          field: "salesCommissionFloorBps",
          label: a.fieldCommissionFloor,
          unit: a.unitBps,
          /* Empty means NO floor is set, not a floor of zero. */
          hint: `${a.bpsHint} ${a.leaveEmptyForNone}`,
        },
        {
          field: "salesMaxFreeMonths",
          label: a.fieldMaxFreeMonths,
          unit: a.unitMonths,
          hint: a.leaveEmptyForNone,
        },
      ],
    },
    {
      title: a.groupTryOn,
      note: a.groupTryOnNote,
      rows: [
        { field: "tryOnModelId", label: a.fieldTryOnModel },
        { field: "tryOnFallbackModelId", label: a.fieldTryOnFallback },
        {
          field: "tryOnMonthlyBudgetCents",
          label: a.fieldTryOnBudget,
          unit: a.unitCents,
          hint: a.usdNotEgp,
        },
        {
          field: "tryOnAccountLifetimeCap",
          label: a.fieldTryOnLifetimeCap,
          hint: a.lifetimeCapNote,
        },
      ],
    },
    {
      title: a.groupChat,
      note: a.groupChatNote,
      rows: [
        {
          field: "chatAttachmentMaxBytes",
          label: a.fieldChatMaxBytes,
          unit: a.unitBytes,
        },
        {
          field: "chatAttachmentAllowedMimeTypes",
          label: a.fieldChatMimeTypes,
          unit: a.unitCommaSeparated,
        },
        {
          field: "guestThreadLifetimeDays",
          label: a.fieldGuestThreadDays,
          unit: a.unitDays,
        },
        {
          field: "chatUnansweredThresholdMinutes",
          label: a.fieldChatUnanswered,
          unit: a.unitMinutes,
        },
      ],
    },
    {
      title: a.groupBadges,
      note: a.groupBadgesNote,
      rows: [
        {
          field: "badgeMinOrderCount",
          label: a.fieldBadgeMinOrders,
          unit: a.unitOrders,
        },
        {
          field: "badgeWindowDays",
          label: a.fieldBadgeWindowDays,
          unit: a.unitDays,
        },
        {
          field: "badgeSameDayShareBpsThreshold",
          label: a.fieldBadgeSameDay,
          unit: a.unitBps,
          hint: a.bpsHint,
        },
        {
          field: "badgeFastConfirmMinutesThreshold",
          label: a.fieldBadgeFastConfirm,
          unit: a.unitMinutes,
        },
        {
          field: "badgeCancellationRateBpsMax",
          label: a.fieldBadgeCancelMax,
          unit: a.unitBps,
          hint: a.bpsHint,
        },
      ],
    },
  ];

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.settingsNote}</p>

      <Alert>
        <AlertTitle>{a.flatWriteNote}</AlertTitle>
      </Alert>

      {groups.map((group) => (
        <Card key={group.title} className="shadow-none">
          <CardContent className="grid gap-4 px-4 py-4">
            <div className="grid gap-1">
              <h3 className="text-base font-semibold text-foreground">
                {group.title}
              </h3>
              <p className="text-sm text-muted-foreground">{group.note}</p>
            </div>
            <Separator />

            {group.rows.map((row) => {
              const isTimezone = row.field === "analyticsTimezone";
              const invalid = diff.invalid.includes(row.field);
              return (
                <div key={row.field} className="grid max-w-xl gap-2">
                  <label
                    htmlFor={`setting-${row.field}`}
                    className="text-sm font-medium text-foreground"
                  >
                    {row.label}
                    {row.unit ? (
                      <span className="ms-2 text-xs font-normal text-muted-foreground">
                        {row.unit}
                      </span>
                    ) : null}
                    {isTimezone ? (
                      <span className="ms-2 text-xs font-normal text-state-wait-fg">
                        {a.timezoneReadOnly}
                      </span>
                    ) : null}
                  </label>
                  <Input
                    id={`setting-${row.field}`}
                    value={form[row.field]}
                    aria-invalid={invalid}
                    onChange={(event) => set(row.field, event.target.value)}
                  />
                  {row.hint ? (
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                  ) : null}
                  {isTimezone && refusedTimezone ? (
                    <p
                      role="status"
                      data-testid="timezone-refused"
                      className="text-sm text-state-wait-fg"
                    >
                      {a.timezoneReason}
                    </p>
                  ) : null}
                  {invalid ? (
                    <p role="status" className="text-sm text-state-bad-fg">
                      {a.saveFailed}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <p className="text-sm text-muted-foreground">
        {diff.changed.length === 0
          ? a.settingsNoChanges
          : a.settingsChangedCount.replace("{n}", String(diff.changed.length))}
      </p>

      <Button
        className="min-h-11 justify-self-start"
        disabled={!diff.body}
        onClick={save}
      >
        {a.saveSettings}
      </Button>

      {outcome === "saved" ? (
        <p role="status" className="text-sm text-state-good-fg">
          {a.settingsSaved}
        </p>
      ) : null}
      {outcome === "failed" ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {a.saveFailed}
        </p>
      ) : null}
    </div>
  );
}
