"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";
import { useBrandProfileWrite } from "./settings-data";
import { inEgypt, type LocationWire } from "./settings-wire";

// Leaflet reads `window` on import, so it never runs on the server.
const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-md" />,
});

/**
 * Where the shop is — what lets the storefront sort shops nearest-first.
 *
 * ITS OWN SAVE, like the hours: `{ location }` whole, or `{ location: null }`
 * to clear it, through the same write the rest of the screen uses. Egypt's box
 * is checked here before the server checks it again.
 *
 * Owner only to change; an employee sees the point as text, with no controls.
 */
export function LocationSection({ initial }: { initial: LocationWire | null }) {
  const l = useMessages().brand.location;
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "BRAND_OWNER";
  const write = useBrandProfileWrite();

  const [point, setPoint] = useState<LocationWire | null>(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState(false);

  const outside = point !== null && !inEgypt(point);

  const place = (next: LocationWire | null) => {
    setPoint(next);
    setProblem(null);
    setSaved(false);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setProblem(l.unavailable);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        place({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        setLocating(false);
        setProblem(
          error.code === error.PERMISSION_DENIED ? l.denied : l.unavailable
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async () => {
    setSaved(false);
    if (outside) return;
    const result = await write.save({ location: point });
    if (result) setSaved(true);
  };

  const coords = (p: LocationWire) =>
    l.coords
      .replace("{lat}", p.latitude.toFixed(5))
      .replace("{lng}", p.longitude.toFixed(5));

  return (
    <section aria-label={l.block} data-testid="settings-location">
      <Card className="border-border">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">{l.title}</CardTitle>
          <CardDescription>{l.description}</CardDescription>
        </CardHeader>

        <CardContent className="grid max-w-xl gap-4">
          {!isOwner ? (
            <>
              <p className="text-sm text-muted-foreground">{l.readOnly}</p>
              <p className="text-sm">{initial ? coords(initial) : l.notSet}</p>
            </>
          ) : (
            <>
              <LocationMap point={point} onPick={place} label={l.mapLabel} />

              <p className="text-xs text-muted-foreground" data-testid="location-coords">
                {point ? coords(point) : l.notSet}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={locating}
                  onClick={locateMe}
                >
                  {locating ? l.locating : l.useMine}
                </Button>
                {point ? (
                  <Button type="button" variant="ghost" onClick={() => place(null)}>
                    {l.remove}
                  </Button>
                ) : null}
              </div>

              {outside ? (
                <p role="alert" className="text-sm text-destructive">
                  {l.outsideEgypt}
                </p>
              ) : null}
              {problem ? (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              ) : null}
              {write.failed ? (
                <p role="alert" className="text-sm text-destructive">
                  {l.failed}
                </p>
              ) : null}
              {saved ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {l.saved}
                </p>
              ) : null}

              <div>
                <Button
                  type="button"
                  disabled={write.pending || outside}
                  onClick={() => void save()}
                >
                  {write.pending ? l.saving : l.save}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
