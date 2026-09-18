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
import { useSession } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";
import { useBrandProfileWrite } from "./settings-data";
import type { HoursWire } from "./settings-wire";

/**
 * When the shop opens — what turns into "Open" or "Closed" on its storefront
 * card, worked out there in Cairo time.
 *
 * ITS OWN SAVE. The three values only mean something together, the server
 * takes them whole, and a shop fixing its closing time should not have to get
 * its tax number right first. So this section saves `{ hours }` and nothing
 * else, through the same write the rest of the screen uses.
 *
 * Both times or neither. Empty means "not given", and the card then shows no
 * badge — never "closed", which would lose a shop the sale for a gap in a form.
 *
 * Owner only to change, like the rest of the profile; an employee sees the
 * hours as text, with no controls, because this screen's rule is absent rather
 * than disabled.
 */
export function HoursSection({ initial }: { initial: HoursWire | undefined }) {
  const h = useMessages().brand.hours;
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "BRAND_OWNER";
  const write = useBrandProfileWrite();

  const [opensAt, setOpensAt] = useState(initial?.opensAt ?? "");
  const [closesAt, setClosesAt] = useState(initial?.closesAt ?? "");
  const [closedDays, setClosedDays] = useState<number[]>(initial?.closedDays ?? []);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const overnight = opensAt !== "" && closesAt !== "" && closesAt < opensAt;

  const toggleDay = (day: number) => {
    setSaved(false);
    setClosedDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    );
  };

  const save = async () => {
    setSaved(false);
    if ((opensAt === "") !== (closesAt === "")) {
      setProblem(h.bothOrNeither);
      return;
    }
    if (opensAt !== "" && opensAt === closesAt) {
      setProblem(h.sameTime);
      return;
    }
    setProblem(null);

    const result = await write.save({
      hours: {
        opensAt: opensAt || null,
        closesAt: closesAt || null,
        closedDays,
      },
    });
    if (result) setSaved(true);
  };

  return (
    <section aria-label={h.block} data-testid="settings-hours">
      <Card className="border-border">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">{h.title}</CardTitle>
          <CardDescription>{h.description}</CardDescription>
        </CardHeader>

        <CardContent className="grid max-w-xl gap-4">
          {!isOwner ? (
            <>
              <p className="text-sm text-muted-foreground">{h.readOnly}</p>
              <p className="font-mono text-sm" dir="ltr">
                {initial?.opensAt && initial.closesAt
                  ? `${initial.opensAt} – ${initial.closesAt}`
                  : h.notGiven}
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{h.opens}</span>
                  <Input
                    type="time"
                    dir="ltr"
                    value={opensAt}
                    onChange={(event) => {
                      setOpensAt(event.target.value);
                      setSaved(false);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">{h.closes}</span>
                  <Input
                    type="time"
                    dir="ltr"
                    value={closesAt}
                    onChange={(event) => {
                      setClosesAt(event.target.value);
                      setSaved(false);
                    }}
                  />
                </label>
              </div>

              {overnight ? (
                <p className="text-xs text-muted-foreground">{h.pastMidnight}</p>
              ) : null}

              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">{h.closedDays}</legend>
                <div className="flex flex-wrap gap-2">
                  {h.days.map((name, day) => (
                    <label
                      key={day}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="checkbox"
                        checked={closedDays.includes(day)}
                        onChange={() => toggleDay(day)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </fieldset>

              {problem ? (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              ) : null}
              {write.failed ? (
                <p role="alert" className="text-sm text-destructive">
                  {h.failed}
                </p>
              ) : null}
              {saved ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {h.saved}
                </p>
              ) : null}

              <div>
                <Button type="button" onClick={() => void save()}>
                  {write.pending ? h.saving : h.save}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
