import { z } from 'zod';

/**
 * Bilingual content: { ar, en }. At least one language is required, never
 * both — a both-required rule makes catalog import unfinishable
 * (loqal-backend/prisma/schema.prisma header, rule 4).
 */
export const bilingualSchema = z
  .object({
    ar: z.string().trim().min(1).max(2000).optional(),
    en: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.ar || v.en), {
    message: 'At least one of ar or en is required',
  });

export type Bilingual = z.infer<typeof bilingualSchema>;

/**
 * Money crosses the wire as a string, never a float. A JS number cannot hold
 * every EGP amount exactly, and `a + b` on two Prisma.Decimal values
 * concatenates them as text — see loqal-backend/src/common/money.ts.
 */
export const moneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Expected an amount like 149.99');

export type Money = z.infer<typeof moneySchema>;
