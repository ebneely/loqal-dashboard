"use client";

/**
 * Everything /admin/settings reads and writes.
 *
 * Both shapes ARE in the contract package, and both were checked against
 * `PlatformSettingsAdminService`: `toSettingsView()` is exactly
 * `platformSettingsSchema`, and `UpdatePlatformSettingsDto` is exactly
 * `updatePlatformSettingsBodySchema`. This is the one screen in the operations
 * half where nothing had to be described locally.
 *
 * Every rate, window and threshold in this system is data rather than code, on
 * purpose: a badge that becomes unearnable because the market moved should be a
 * settings change and not a release. That is why this screen exists and why it
 * reaches into five unrelated subsystems.
 */
import {
  platformSettingsSchema,
  type PlatformSettings,
  type UpdatePlatformSettingsBody,
} from "@loqal/contracts/admin.contract";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

const SETTINGS_PATH = "/v1/admin/settings";

export type { PlatformSettings };

export function usePlatformSettings(): Resource<PlatformSettings> {
  return useResource("admin-platform-settings", true, (signal) =>
    api.get(platformSettingsSchema, SETTINGS_PATH, { signal })
  );
}

/**
 * The PATCH answers the same grouped shape the GET does, so it is parsed with
 * the same schema — this is the one write in the operations console whose
 * response is actually described by a contract. The screen still refetches,
 * because the row carries `updatedAt` and a save is exactly the moment that
 * changes.
 */
export const savePlatformSettings = (body: UpdatePlatformSettingsBody) =>
  api.patch(platformSettingsSchema, SETTINGS_PATH, body);
