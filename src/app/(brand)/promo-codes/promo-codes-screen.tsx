"use client";

/**
 * Promo codes — one screen for two consoles.
 *
 * The shop's /promo-codes and the admin console's /admin/promo-codes are the
 * same list and form against a different path (see `promo-codes-data.ts`).
 * Who pays is the one thing that differs in words, so the note above the form
 * is passed in.
 *
 * A 404 on the list means the API has no promo codes yet: the screen says so
 * calmly and draws no form, since every write would 404 too.
 */
import { useState, type ReactNode } from "react";

import {
  ListState,
  ResponsiveList,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ApiError, describeFailure, type Failure } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import {
  EMPTY_PROMO_FORM,
  createPromoCode,
  formFromCode,
  promoProblems,
  setPromoActive,
  toLocalInput,
  updatePromoCode,
  usePromoCodes,
  type PromoCode,
  type PromoForm,
} from "./promo-codes-data";

type Props = {
  path: string;
  /** One line on who pays for these codes. */
  note: string;
  requiredRole: string;
  deniedTitle: string;
  deniedBody: string;
};

type Outcome = { ok: string } | { failed: Failure } | null;

const dateText = (iso: string | null) => toLocalInput(iso).replace("T", " ");

export function PromoCodesScreen({ path, note, requiredRole, deniedTitle, deniedBody }: Props) {
  const p = useMessages().brand.promo;
  const resource = usePromoCodes(path);

  const [form, setForm] = useState<PromoForm>(EMPTY_PROMO_FORM);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const rows = resource.data ?? [];
  const problems = promoProblems(form);
  // "required" stays silent: an untouched form is not an error, Save is just off.
  const problemFor = (field: keyof PromoForm) => {
    const problem = problems[field];
    return problem && problem !== "required" ? p.problem[problem] : null;
  };

  const set = <K extends keyof PromoForm>(field: K, value: PromoForm[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const run = async (work: () => Promise<unknown>, ok: string) => {
    setPending(true);
    setOutcome(null);
    try {
      await work();
      setOutcome({ ok });
      resource.reload();
      return true;
    } catch (thrown) {
      setOutcome({
        failed: describeFailure(thrown, {
          conflict: p.failConflict,
          notFound: p.failNotFound,
          refused: p.failRefused,
          generic: p.failGeneric,
        }),
      });
      return false;
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY_PROMO_FORM);
  };

  const submit = async () => {
    if (Object.keys(problems).length > 0) return;
    const done = editing
      ? await run(() => updatePromoCode(path, editing.id, form), p.saved)
      : await run(() => createPromoCode(path, form), p.created);
    if (done) reset();
  };

  if (resource.error instanceof ApiError && resource.error.isNotFound) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">{note}</p>
        <ListState state="empty" title={p.unavailableTitle} body={p.unavailableBody} />
      </div>
    );
  }

  const state = listStateFor(resource.error, {
    isLoading: resource.isLoading,
    isEmpty: rows.length === 0,
  });

  if (state === "denied") {
    return (
      <ListState state="denied" title={deniedTitle} body={deniedBody} requiredRole={requiredRole} />
    );
  }

  const field = (
    name: Exclude<keyof PromoForm, "kind" | "active">,
    label: string,
    input: { type?: string; inputMode?: "decimal" | "numeric"; hint?: string }
  ): ReactNode => {
    const id = `promo-${name}`;
    const problem = problemFor(name);
    const noteId = problem || input.hint ? `${id}-note` : undefined;
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          dir="ltr"
          type={input.type ?? "text"}
          inputMode={input.inputMode}
          value={String(form[name])}
          aria-invalid={problem ? true : undefined}
          aria-describedby={noteId}
          onChange={(event) => set(name, event.target.value)}
        />
        {noteId ? (
          <p
            id={noteId}
            className={problem ? "text-xs text-state-bad-fg" : "text-xs text-muted-foreground"}
          >
            {problem ?? input.hint}
          </p>
        ) : null}
      </div>
    );
  };

  const discountText = (row: PromoCode) =>
    row.kind === "PERCENT"
      ? [
          `${row.value}%`,
          row.maxDiscount ? p.upTo.replace("{amount}", formatMoney(row.maxDiscount)) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : formatMoney(row.value);

  const conditionsText = (row: PromoCode) => {
    const parts = [
      row.minSubtotal ? p.minOrder.replace("{amount}", formatMoney(row.minSubtotal)) : null,
      row.startsAt ? p.from.replace("{date}", dateText(row.startsAt)) : null,
      row.endsAt ? p.until.replace("{date}", dateText(row.endsAt)) : null,
      row.perCustomerLimit !== null
        ? p.perCustomer.replace("{n}", String(row.perCustomerLimit))
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : p.noConditions;
  };

  const usesText = (row: PromoCode) => {
    const limit = row.usageLimit === null ? null : String(row.usageLimit);
    if (row.redemptionCount === null) {
      return limit ? p.usesLimit.replace("{limit}", limit) : p.usesNone;
    }
    const used = String(row.redemptionCount);
    return limit
      ? p.usesOf.replace("{used}", used).replace("{limit}", limit)
      : p.usesUnlimited.replace("{used}", used);
  };

  const columns: readonly ResponsiveListColumn<PromoCode>[] = [
    {
      key: "code",
      header: p.colCode,
      cell: (row) => <span className="font-mono font-medium" dir="ltr">{row.code}</span>,
      primary: true,
    },
    { key: "discount", header: p.colDiscount, cell: discountText },
    { key: "conditions", header: p.colConditions, cell: conditionsText, meta: true },
    { key: "uses", header: p.colUses, cell: usesText, numeric: true },
    {
      key: "status",
      header: p.colStatus,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" data-active={row.active}>
            {row.active ? p.statusActive : p.statusInactive}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setOutcome(null);
              setEditing(row);
              setForm(formFromCode(row));
            }}
          >
            {p.edit}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label={`${row.active ? p.deactivate : p.activate}: ${row.code}`}
            onClick={() => void run(() => setPromoActive(path, row.id, !row.active), p.saved)}
          >
            {row.active ? p.deactivate : p.activate}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{note}</p>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <h2 className="text-base font-medium text-foreground md:col-span-3">
            {editing ? p.editTitle.replace("{code}", editing.code) : p.newTitle}
          </h2>
          {field("code", p.code, { hint: p.codeHint })}
          <div className="grid gap-2">
            <Label htmlFor="promo-kind">{p.kind}</Label>
            <NativeSelect
              id="promo-kind"
              className="w-full"
              value={form.kind}
              onChange={(event) =>
                set("kind", event.target.value === "FIXED" ? "FIXED" : "PERCENT")
              }
            >
              <NativeSelectOption value="PERCENT">{p.kindPercent}</NativeSelectOption>
              <NativeSelectOption value="FIXED">{p.kindFixed}</NativeSelectOption>
            </NativeSelect>
          </div>
          {field("value", form.kind === "PERCENT" ? p.valuePercent : p.valueFixed, {
            inputMode: form.kind === "PERCENT" ? "numeric" : "decimal",
          })}
          {form.kind === "PERCENT"
            ? field("maxDiscount", p.maxDiscount, { inputMode: "decimal" })
            : null}
          {field("minSubtotal", p.minSubtotal, { inputMode: "decimal" })}
          {field("startsAt", p.startsAt, { type: "datetime-local" })}
          {field("endsAt", p.endsAt, { type: "datetime-local" })}
          {field("usageLimit", p.usageLimit, { inputMode: "numeric" })}
          {field("perCustomerLimit", p.perCustomerLimit, { inputMode: "numeric" })}
          <div className="flex items-center gap-3">
            <Switch
              id="promo-active"
              checked={form.active}
              onCheckedChange={(next) => set("active", next === true)}
            />
            <Label htmlFor="promo-active">{p.active}</Label>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <Button
              className="min-h-11"
              disabled={pending || Object.keys(problems).length > 0}
              onClick={() => void submit()}
            >
              {pending ? p.saving : editing ? p.save : p.create}
            </Button>
            {editing ? (
              <Button variant="ghost" className="min-h-11" onClick={reset}>
                {p.cancelEdit}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {outcome && "ok" in outcome ? (
        <p role="status" className="text-sm text-state-good-fg">
          {outcome.ok}
        </p>
      ) : null}
      {outcome && "failed" in outcome ? (
        <div role="alert" className="grid gap-1 text-sm text-state-bad-fg">
          <span>{outcome.failed.title}</span>
          {outcome.failed.detail ? (
            <span className="text-xs text-muted-foreground">{outcome.failed.detail}</span>
          ) : null}
        </div>
      ) : null}

      {state === "loading" ? <ListState state="loading" rows={3} /> : null}
      {state === "error" ? (
        <ListState
          state="error"
          title={p.errorTitle}
          body={p.errorBody}
          actionLabel={p.retry}
          onAction={resource.reload}
        />
      ) : null}
      {state === "empty" ? (
        <ListState state="empty" title={p.emptyTitle} body={p.emptyBody} />
      ) : null}
      {state === null ? (
        <ResponsiveList
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.id}
          caption={p.caption}
        />
      ) : null}
    </div>
  );
}
