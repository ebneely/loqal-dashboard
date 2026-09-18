"use client";

/**
 * Everything /settings reads and writes.
 *
 * ONE read and ONE write, both on `/v1/brands/me`. The read is open to a brand
 * employee as well as the owner and answers with the owner-only blocks ABSENT
 * for the former; the write is `@Roles(BRAND_OWNER)` and answers 403 to an
 * employee, which is why the save is offered on the strength of the payload
 * rather than on the strength of the session.
 *
 * Both go through the wire schemas beside this file. See `settings-wire.ts` for
 * the four places the shipped API and the contract do not yet agree, and why
 * each difference is recorded there instead of patched over here.
 */
import { useCallback, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

import {
  brandProfileWireSchema,
  updateBrandProfileWireSchema,
  type BrandProfileWire,
  type UpdateBrandProfileWire,
} from "./settings-wire";

export function useBrandProfile(): Resource<BrandProfileWire> {
  return useResource("settings:brand", true, (signal) =>
    api.get(brandProfileWireSchema, "/v1/brands/me", { signal })
  );
}

/**
 * The form's flat body, in the GROUPED shape `PATCH /v1/brands/me` accepts.
 *
 * The server grouped these fields — `trading`, `invoiceIdentity` — to mirror
 * how `/brands/me` reads them, and its DTO is `.strict()`. This screen kept
 * sending them flat, so every save that touched a delivery fee, a return
 * window or a tax number was a 400 ("Unrecognized keys") that the shop saw as
 * "that did not save", for as long as the two disagreed.
 *
 * A group is sent only when one of its fields is: an empty `trading: {}`
 * would be harmless, but "only what changed" is the rule the rest of the save
 * follows. Top-level fields pass through as they are.
 */
export function toServerBody(body: UpdateBrandProfileWire): Record<string, unknown> {
  const {
    deliveryFee,
    returnWindowDays,
    minimumOrderValue,
    stockSetup,
    supportedDelivery,
    legalName,
    taxNumber,
    invoiceAddress,
    ...top
  } = body;

  const defined = (group: Record<string, unknown>) => {
    const kept = Object.fromEntries(
      Object.entries(group).filter(([, value]) => value !== undefined)
    );
    return Object.keys(kept).length > 0 ? kept : undefined;
  };

  const trading = defined({
    deliveryFee,
    returnWindowDays,
    minimumOrderValue,
    stockSetup,
    supportedDelivery,
  });
  const invoiceIdentity = defined({ legalName, taxNumber, invoiceAddress });

  return {
    ...top,
    ...(trading ? { trading } : {}),
    ...(invoiceIdentity ? { invoiceIdentity } : {}),
  };
}

export type SettingsWrite = {
  save: (body: UpdateBrandProfileWire) => Promise<BrandProfileWire | null>;
  pending: boolean;
  failed: boolean;
  /** True when the API refused the write on role rather than on content. */
  denied: boolean;
};

/**
 * The save.
 *
 * The body is parsed against the wire schema BEFORE it leaves. The server's DTO
 * is `.strict()`, so one extra key — a settlement field, a status, anything
 * grouped the way the read groups it — is a 400 with a message about an unknown
 * property, which is not a sentence to put in front of a shop. Parsing here
 * turns that into a bug caught in this file.
 *
 * `denied` is kept apart from `failed` because the two need different screens:
 * a failed save is worth pressing again and a refused one is not.
 */
export function useBrandProfileWrite(): SettingsWrite {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);

  const save = useCallback(async (body: UpdateBrandProfileWire) => {
    const parsed = updateBrandProfileWireSchema.safeParse(body);
    if (!parsed.success) {
      setFailed(true);
      return null;
    }

    setPending(true);
    setFailed(false);
    setDenied(false);
    try {
      // The response is the profile as it now stands, so the screen re-renders
      // from what was saved rather than from what it hoped was saved.
      return await api.patch(
        brandProfileWireSchema,
        "/v1/brands/me",
        toServerBody(parsed.data)
      );
    } catch (thrown: unknown) {
      if (thrown instanceof ApiError && thrown.isPermissionDenied) {
        setDenied(true);
      } else {
        setFailed(true);
      }
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return { save, pending, failed, denied };
}
