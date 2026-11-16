"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useSession } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";
import { useBrandProfileWrite } from "./settings-data";
import { deliveryTimeWireSchema, type DeliveryTimeWire } from "./settings-wire";

/**
 * How long a delivery takes — shown on the shop's storefront card.
 *
 * Five ready ranges cover most shops; "custom" takes any range from 15 minutes
 * to three days. ITS OWN SAVE, like the hours: one value, sent whole as
 * `deliveryTime` (null clears it). Owner only to change; an employee reads it.
 */
export const DELIVERY_PRESETS = [
  { key: "withinHour", minMinutes: 30, maxMinutes: 60 },
  { key: "oneToTwoHours", minMinutes: 60, maxMinutes: 120 },
  { key: "twoToFourHours", minMinutes: 120, maxMinutes: 240 },
  { key: "sameDay", minMinutes: 240, maxMinutes: 720 },
  { key: "oneToTwoDays", minMinutes: 1440, maxMinutes: 2880 },
] as const;

type PresetKey = (typeof DELIVERY_PRESETS)[number]["key"];
export type DeliveryChoice = "none" | PresetKey | "custom";
export type DeliveryUnit = "minutes" | "hours" | "days";

const UNIT_MINUTES: Record<DeliveryUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** Which option a stored range is: a preset when it matches one exactly, else custom. */
export function choiceFor(time: DeliveryTimeWire | null): DeliveryChoice {
  if (!time) return "none";
  const preset = DELIVERY_PRESETS.find(
    (p) => p.minMinutes === time.minMinutes && p.maxMinutes === time.maxMinutes
  );
  return preset ? preset.key : "custom";
}

/** The largest unit both ends divide into, so 1440–2880 reads as 1–2 days. */
export function unitFor(time: DeliveryTimeWire): DeliveryUnit {
  if (time.minMinutes % 1440 === 0 && time.maxMinutes % 1440 === 0) return "days";
  if (time.minMinutes % 60 === 0 && time.maxMinutes % 60 === 0) return "hours";
  return "minutes";
}

/** A typed custom range, in minutes, or null when the server would refuse it. */
export function customRange(
  from: string,
  to: string,
  unit: DeliveryUnit
): DeliveryTimeWire | null {
  if (!/^\d+$/.test(from.trim()) || !/^\d+$/.test(to.trim())) return null;
  const range = {
    minMinutes: Number(from) * UNIT_MINUTES[unit],
    maxMinutes: Number(to) * UNIT_MINUTES[unit],
  };
  return deliveryTimeWireSchema.safeParse(range).success ? range : null;
}

export function DeliveryTimeSection({ initial }: { initial: DeliveryTimeWire | null }) {
  const d = useMessages().brand.deliveryTime;
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "BRAND_OWNER";
  const write = useBrandProfileWrite();

  const startUnit = initial ? unitFor(initial) : "hours";
  const [choice, setChoice] = useState<DeliveryChoice>(choiceFor(initial));
  const [unit, setUnit] = useState<DeliveryUnit>(startUnit);
  const [from, setFrom] = useState(
    initial ? String(initial.minMinutes / UNIT_MINUTES[startUnit]) : ""
  );
  const [to, setTo] = useState(
    initial ? String(initial.maxMinutes / UNIT_MINUTES[startUnit]) : ""
  );
  const [saved, setSaved] = useState(false);

  const custom = customRange(from, to, unit);
  const customTyped = from.trim() !== "" || to.trim() !== "";
  const value: DeliveryTimeWire | null | undefined =
    choice === "none"
      ? null
      : choice === "custom"
        ? custom ?? undefined
        : DELIVERY_PRESETS.find((p) => p.key === choice);

  const describe = (time: DeliveryTimeWire | null): string => {
    const picked = choiceFor(time);
    if (!time || picked === "none") return d.notGiven;
    if (picked !== "custom") return d.presets[picked];
    const u = unitFor(time);
    return `${time.minMinutes / UNIT_MINUTES[u]}–${time.maxMinutes / UNIT_MINUTES[u]} ${d.units[u]}`;
  };

  const save = async () => {
    setSaved(false);
    if (value === undefined) return;
    const result = await write.save({
      deliveryTime: value === null ? null : { minMinutes: value.minMinutes, maxMinutes: value.maxMinutes },
    });
    if (result) setSaved(true);
  };

  const options: { key: DeliveryChoice; label: string }[] = [
    ...DELIVERY_PRESETS.map((p) => ({ key: p.key, label: d.presets[p.key] })),
    { key: "custom", label: d.custom },
    { key: "none", label: d.none },
  ];

  return (
    <section aria-label={d.block} data-testid="settings-delivery-time">
      <Card className="border-border">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">{d.title}</CardTitle>
          <CardDescription>{d.description}</CardDescription>
        </CardHeader>

        <CardContent className="grid max-w-xl gap-4">
          {!isOwner ? (
            <>
              <p className="text-sm text-muted-foreground">{d.readOnly}</p>
              <p className="text-sm">{describe(initial)}</p>
            </>
          ) : (
            <>
              <fieldset className="grid gap-2">
                <legend className="sr-only">{d.title}</legend>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="radio"
                        name="delivery-time"
                        value={option.key}
                        checked={choice === option.key}
                        onChange={() => {
                          setChoice(option.key);
                          setSaved(false);
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {choice === "custom" ? (
                <div className="grid grid-cols-3 gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">{d.from}</span>
                    <Input
                      inputMode="numeric"
                      dir="ltr"
                      value={from}
                      aria-invalid={customTyped && !custom ? true : undefined}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setSaved(false);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">{d.to}</span>
                    <Input
                      inputMode="numeric"
                      dir="ltr"
                      value={to}
                      aria-invalid={customTyped && !custom ? true : undefined}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setSaved(false);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">{d.unit}</span>
                    <NativeSelect
                      value={unit}
                      onChange={(event) => {
                        setUnit(event.target.value as DeliveryUnit);
                        setSaved(false);
                      }}
                    >
                      {(Object.keys(UNIT_MINUTES) as DeliveryUnit[]).map((u) => (
                        <NativeSelectOption key={u} value={u}>
                          {d.units[u]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
              ) : null}

              {choice === "custom" && customTyped && !custom ? (
                <p role="alert" className="text-sm text-destructive">
                  {d.invalid}
                </p>
              ) : null}
              {write.failed ? (
                <p role="alert" className="text-sm text-destructive">
                  {d.failed}
                </p>
              ) : null}
              {saved ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {d.saved}
                </p>
              ) : null}

              <div>
                <Button
                  type="button"
                  disabled={write.pending || value === undefined}
                  onClick={() => void save()}
                >
                  {write.pending ? d.saving : d.save}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
