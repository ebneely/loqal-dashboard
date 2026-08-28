"use client";

/**
 * /analytics on the brand console — the shop's own trade, and nothing else.
 *
 * Composed from the domain layer: ListState, over the shared
 * `CommerceDashboard`. The screen itself is thin on purpose: the drawing is
 * the same on both consoles and only the SCOPE and the copy differ, so a
 * second implementation here would be the same screen twice, drifting.
 *
 * IT LIVES OUTSIDE /admin BECAUSE IT HAS TO. `(admin)/layout.tsx` redirects
 * any session that is not SUPER_ADMIN to /today, so a shop owner could never
 * reach a route under that group whatever the API allowed.
 *
 * OWNER ONLY, AND THE SAME RULE /money USES.
 *
 * Nothing is drawn until the role is known — an optimistic render corrected a
 * tick later flashes the shop's revenue at whoever is holding the phone, and a
 * flash is a leak. Only the literal string BRAND_OWNER opens it: SALES,
 * SUPER_ADMIN and any role this build has never heard of are treated as an
 * employee, because guessing wrong in the other direction shows a shop's money
 * to somebody who was never meant to see it.
 *
 * The refusal is ABSENT, not disabled. No figures, no charts, no map, and no
 * request made at all — `CommerceDashboard` is not rendered, so its fetch never
 * mounts. A greyed-out revenue tile would still answer "does this shop take
 * money", and a shop that hands someone a counter login has not agreed to that.
 */
import { ListState } from "@/components/loqal";
import { useSession } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";

import { CommerceDashboard } from "../../(admin)/admin/analytics/commerce-dashboard";

export const BRAND_ANALYTICS_ROLE = "BRAND_OWNER";

export function BrandAnalyticsScreen() {
  const t = useMessages();
  const copy = t.brand.commerce;
  const { data: session, isPending } = useSession();

  const isOwner = session?.user?.role === BRAND_ANALYTICS_ROLE;

  if (isPending) return <ListState state="loading" rows={3} />;

  if (!isOwner) {
    return (
      <ListState
        state="denied"
        title={copy.deniedTitle}
        body={copy.deniedBody}
        requiredRole={BRAND_ANALYTICS_ROLE}
      />
    );
  }

  return (
    <CommerceDashboard
      scope="brand"
      copy={copy}
      requiredRole={BRAND_ANALYTICS_ROLE}
    />
  );
}
