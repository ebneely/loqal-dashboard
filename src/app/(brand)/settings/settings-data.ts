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
        parsed.data
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
