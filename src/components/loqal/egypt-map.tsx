"use client";

/**
 * Composed from no shadcn primitive at all: this one is inline SVG.
 *
 * A choropleth of Egypt's 27 governorates, drawn from a static 94 KB
 * geoBoundaries ADM1 file. There is deliberately NO map library. A projection
 * of one country at this latitude is twenty lines of arithmetic, and every
 * library that would do it for us also ships a canvas renderer, a tile client
 * and a tooltip layer this component does not want.
 *
 * Three decisions here are load-bearing and none of them is stylistic:
 *
 * COLOUR IS BY QUANTILE, NOT BY VALUE. Cairo takes a share of Egyptian
 * commerce that no linear ramp survives — against a Cairo-sized maximum the
 * other 26 governorates all round to the same near-white shape, and the map
 * says "Cairo exists", which the reader knew. Ranking spreads them across five
 * steps, so the map answers the question it was drawn for: where else.
 *
 * ZERO IS NOT A BUCKET. A governorate with no orders is `--muted` with a
 * `--border` stroke — visibly nothing — never the palest shade of something.
 * The palest shade of something is how a region with no trade gets read as a
 * region with a little trade.
 *
 * EVERY SHAPE CARRIES ITS OWN NAME AND FIGURE — as a `<title>`, which is the
 * hover tooltip, AND as an `aria-label`, because a `<title>` inside a `<path>`
 * is not reliably taken as that path's accessible name — and the top five are
 * repeated as a ranked list beside the map. A choropleth on its own
 * is unreadable to a screen reader and very nearly unreadable to everybody
 * else: 27 shades cannot be ordered by eye. The map shows the SHAPE of demand
 * and the list shows the AMOUNTS, and neither substitutes for the other.
 *
 * Presentational only. Every string arrives as a prop — this draws shapes, it
 * does not know which language it is in.
 */
import collection from "@/lib/geo/egypt-governorates.json";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type EgyptMapDatum = {
  /** A governorate CODE, as the API emits it — "CAI", "GIZ". */
  code: string;
  /** The place's name in the reader's language. */
  label: string;
  value: number;
  /** An optional second figure for the tooltip and the list, e.g. revenue. */
  detail?: string;
};

/**
 * Code to the geometry's own `properties.name`, which is the join key.
 *
 * These 27 names are byte-identical to `properties.name` in
 * `src/lib/geo/egypt-governorates.json` and to the `en` column of the API's
 * `common/geo/governorates.ts`. A tidier spelling on either side uncolours a
 * governorate and reports nothing where there were orders, silently.
 */
const SHAPE_OF_CODE: Readonly<Record<string, string>> = {
  ALX: "Alexandria",
  ASN: "Aswan",
  AST: "Asyut",
  BEH: "Beheira",
  BNS: "Beni Suef",
  CAI: "Cairo",
  DAK: "Dakahlia",
  DAM: "Damietta",
  FYM: "Faiyum",
  GHR: "Gharbiyya",
  GIZ: "Giza",
  ISM: "Ismailia",
  KFS: "Kafr el-Sheikh",
  LUX: "Luxor",
  MAT: "Matrouh",
  MIN: "Minya",
  MNF: "Monufia",
  NSI: "North Sinai",
  PTS: "Port Said",
  QAL: "Qalyubia",
  QEN: "Qena",
  RED: "Red Sea",
  SHG: "Sohag",
  SHR: "Al Sharqia",
  SSI: "South Sinai",
  SUZ: "Suez",
  WAD: "New Valley",
};

const CODE_OF_SHAPE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SHAPE_OF_CODE).map(([code, name]) => [name, code])
);

type Ring = number[][];
type Feature = {
  properties: { name: string };
  geometry: { type: string; coordinates: unknown };
};

const FEATURES = (collection as unknown as { features: Feature[] }).features;

const polygonsOf = (feature: Feature): Ring[][] =>
  feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Ring[]]
    : (feature.geometry.coordinates as Ring[][]);

/**
 * The bounding box, measured from the geometry rather than written down.
 *
 * Hardcoding it means the day the file is replaced with better boundaries the
 * country slides half out of its own frame, and nothing fails — it just looks
 * subtly wrong.
 */
const BOUNDS = FEATURES.reduce(
  (box, feature) => {
    for (const polygon of polygonsOf(feature)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          box.minLon = Math.min(box.minLon, lon);
          box.maxLon = Math.max(box.maxLon, lon);
          box.minLat = Math.min(box.minLat, lat);
          box.maxLat = Math.max(box.maxLat, lat);
        }
      }
    }
    return box;
  },
  {
    minLon: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
  }
);

const VIEW_WIDTH = 1000;

/**
 * Equirectangular, with ONE scale factor for both axes.
 *
 * Egypt spans 22°N to 32°N, where a proper projection and a flat one differ by
 * less than the stroke width at this size. Two scale factors — one per axis,
 * to fill a box — would not: that is how a country ends up visibly stretched.
 */
const SCALE = VIEW_WIDTH / (BOUNDS.maxLon - BOUNDS.minLon);
const VIEW_HEIGHT = (BOUNDS.maxLat - BOUNDS.minLat) * SCALE;

const round = (value: number) => Math.round(value * 100) / 100;

const pathOf = (feature: Feature): string => {
  const parts: string[] = [];
  for (const polygon of polygonsOf(feature)) {
    for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const x = round((lon - BOUNDS.minLon) * SCALE);
        const y = round((BOUNDS.maxLat - lat) * SCALE);
        parts.push(`${index === 0 ? "M" : "L"}${x} ${y}`);
      });
      parts.push("Z");
    }
  }
  return parts.join("");
};

/** Drawn once, at module load. The geometry is static; the data is not. */
const SHAPES: readonly { code: string; name: string; d: string }[] =
  FEATURES.map((feature) => ({
    code: CODE_OF_SHAPE[feature.properties.name] ?? feature.properties.name,
    name: feature.properties.name,
    d: pathOf(feature),
  }));

/**
 * Grouped textually, so the digits stay Latin in Arabic too.
 *
 * `value.toLocaleString("ar")` returns ١٢٬٤٠٠ into a figures face that has no
 * Arabic glyphs, and the number falls back mid-word to another typeface.
 */
const formatCount = (value: number): string =>
  String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Five steps of one hue. The scale reads as one quantity, not five. */
const BUCKET_OPACITY = [0.22, 0.4, 0.58, 0.78, 1] as const;

/**
 * The bucket a value falls in, by RANK among the values that are not zero.
 *
 * Upper-quantile convention: the largest value is always in the top bucket, so
 * a window with a single active governorate colours it strongest rather than
 * palest. Equal values always share a bucket.
 */
function bucketOf(value: number, ranked: readonly number[]): number | null {
  if (value <= 0 || ranked.length === 0) return null;
  const atOrBelow = ranked.filter((other) => other <= value).length;
  const bucket =
    Math.ceil((atOrBelow / ranked.length) * BUCKET_OPACITY.length) - 1;
  return Math.min(BUCKET_OPACITY.length - 1, Math.max(0, bucket));
}

export type EgyptMapProps = {
  data: readonly EgyptMapDatum[];
  /** Shown over the country when every value is zero. */
  emptyLabel: string;
  /** What the figure counts — "orders", "customers". Read out per shape. */
  valueLabel: string;
  className?: string;
};

export function EgyptMap({
  data,
  emptyLabel,
  valueLabel,
  className,
}: EgyptMapProps) {
  const byCode = new Map(data.map((datum) => [datum.code, datum]));
  const ranked = [...byCode.values()]
    .filter((datum) => datum.value > 0)
    .sort((a, b) => b.value - a.value);
  const scale = ranked.map((datum) => datum.value);
  const reduced = useReducedMotion();
  const blank = ranked.length === 0;

  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center",
        className
      )}
    >
      {/*
        THE BOX IS THE SHAPE OF THE COUNTRY, so there is no slack in it.

        It was `h-64 w-full` in a column twice as wide as the list beside it.
        `preserveAspectRatio` defaults to fit-and-centre, so the country drew
        itself in the middle with a third of the column empty on either side —
        the map looked small and adrift under a heading it was not aligned to.

        Giving the box the viewBox's own ratio means the SVG fills it exactly:
        no centring, nothing to align, and the country starts where the heading
        starts. `justify-self-start` is logical, so it follows the writing
        direction rather than pinning to the left in Arabic.

        A fixed HEIGHT still, not a width — the height is what decides whether a
        governorate is big enough to point at, and the width follows from it.
      */}
      <div
        className="relative h-80 justify-self-start sm:h-96"
        style={{ aspectRatio: `${round(VIEW_WIDTH)} / ${round(VIEW_HEIGHT)}` }}
      >
        <svg
          viewBox={`0 0 ${round(VIEW_WIDTH)} ${round(VIEW_HEIGHT)}`}
          className="h-full w-full"
        >
          {SHAPES.map((shape) => {
            const datum = byCode.get(shape.code);
            const value = datum?.value ?? 0;
            const bucket = bucketOf(value, scale);
            // Busiest first, so the eye is taken to the region that matters.
            const rank = ranked.findIndex((item) => item.code === shape.code);
            const label = datum?.label ?? shape.name;
            const name = `${label}: ${formatCount(value)} ${valueLabel}${
              datum?.detail ? ` · ${datum.detail}` : ""
            }`;

            return (
              <path
                key={shape.code}
                d={shape.d}
                role="img"
                aria-label={name}
                data-governorate={shape.code}
                data-bucket={bucket === null ? "none" : String(bucket)}
                fill={bucket === null ? "var(--muted)" : "var(--chart-1)"}
                fillOpacity={bucket === null ? 1 : BUCKET_OPACITY[bucket]}
                stroke="var(--border)"
                strokeWidth={1}
                strokeLinejoin="round"
                /**
                 * A region answers the pointer. The map had no hover state at
                 * all, so the only way to tell Cairo from Giza was to already
                 * know the shape of Egypt — which is a lot to ask of a legend.
                 *
                 * The coloured ones also fade up on arrival, ordered by rank so
                 * the busiest region lands first and the eye is taken to it.
                 * The delay is bounded: a long tail of quiet governorates must
                 * not make the map take a second to finish.
                 */
                className="lq-map-region"
                style={
                  reduced || bucket === null
                    ? undefined
                    : { animationDelay: `${Math.min(rank * 25, 300)}ms` }
                }
              >
                <title>{name}</title>
              </path>
            );
          })}
        </svg>
        {blank ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-md bg-background/85 px-3 py-1.5 text-xs text-muted-foreground">
              {emptyLabel}
            </span>
          </div>
        ) : null}
      </div>

      {/*
        The list is capped, because the rule under each row runs the width of
        whatever contains it. In a column sized to the rest of the section that
        was a hairline stretching a thousand pixels to underline "Cairo · 53",
        and a rule far longer than the pair it separates reads as a table
        somebody forgot to finish rather than as a list.
      */}
      {blank ? null : (
        <ol className="grid w-full max-w-sm content-start gap-2 justify-self-start">
          {ranked.slice(0, 5).map((datum) => (
            <li
              key={datum.code}
              className="flex items-baseline justify-between gap-x-3 border-b border-border/60 pb-1.5 text-sm last:border-b-0"
            >
              <span className="truncate">{datum.label}</span>
              <span className="shrink-0 font-mono tabular-nums" data-num="">
                {formatCount(datum.value)}
                {datum.detail ? (
                  <span className="ms-2 text-xs text-muted-foreground">
                    {datum.detail}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
