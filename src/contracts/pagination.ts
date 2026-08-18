import { z } from 'zod';

/**
 * Cursor pagination, never offset.
 *
 * A brand works its order list by confirming rows off the top of it. With
 * offset paging, a row that leaves PENDING_BRAND between page one and page two
 * shifts everything up and the row that took its place is never seen — the
 * shopper waiting behind it is invisible until someone reloads. A cursor is
 * anchored to a row, so the list can shrink underneath it without losing
 * anything.
 */
export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable(),
    })
    .strict();

export const cursorQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};
