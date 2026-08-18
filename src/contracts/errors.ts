import { z } from 'zod';

/**
 * The single error body the API emits, formatted by one handler —
 * loqal-backend/src/common/filters/all-exceptions.filter.ts.
 *
 * .strict() is load-bearing rather than tidy: it is what fails the test if a
 * stack trace or an internal cause is ever added to the shape a client sees.
 *
 * `violations` is the one addition, and it is OPTIONAL and additive on
 * purpose: the three fields above keep their exact names, types and meaning,
 * so every client already reading them is untouched, and an error carrying no
 * violations parses to the identical object it did before this field existed.
 *
 * It exists because a 422 that says only "outside the band a rep may close"
 * makes the rep guess which half of the band it broke — the commission floor
 * or the free-months cap — and guess in front of a prospect. The server
 * already computes that list (loqal-backend lib/commercial-band.ts returns
 * EVERY violation, never just the first); the flattening handler was throwing
 * it away one line before the wire. Strings, not codes: they are written to be
 * read out as-is, and a code table would be a second thing to keep in sync.
 */
export const apiErrorSchema = z
  .object({
    statusCode: z.number().int(),
    message: z.string(),
    error: z.string(),
    violations: z.array(z.string()).optional(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Withheld rather than absent.
 *
 * Some figures shown to a brand we have not signed are aggregates over other
 * brands, and below the k-anonymity floor an average stops being a market fact
 * and becomes one competitor's private revenue. Returning null or zero there
 * reads as "we measured nothing", which is a different and untrue claim — so
 * the field carries its own reason and the UI draws a deliberate blocked state.
 */
export const withheldSchema = z
  .object({
    withheld: z.literal(true),
    reason: z.enum(['K_ANONYMITY', 'NOT_ENTITLED']),
  })
  .strict();

export type Withheld = z.infer<typeof withheldSchema>;

/** A value that may legitimately be refused rather than reported. */
export const withholdable = <T extends z.ZodTypeAny>(value: T) =>
  z.union([value, withheldSchema]);

export const isWithheld = (v: unknown): v is Withheld =>
  typeof v === 'object' && v !== null && (v as { withheld?: unknown }).withheld === true;
