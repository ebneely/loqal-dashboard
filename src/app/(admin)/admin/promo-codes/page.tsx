"use client";

/**
 * The route file, and nothing else. loqaaal's own codes — loqaaal pays. Same
 * screen as the shop's, against the admin path.
 */
import { PromoCodesScreen } from "@/app/(brand)/promo-codes/promo-codes-screen";
import { ADMIN_PROMO_PATH } from "@/app/(brand)/promo-codes/promo-codes-data";
import { useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";

export default function AdminPromoCodesPage() {
  const a = useMessages().admin;
  return (
    <PromoCodesScreen
      path={ADMIN_PROMO_PATH}
      note={a.promoNote}
      requiredRole={ADMIN_REQUIRED_ROLE}
      deniedTitle={a.deniedTitle}
      deniedBody={a.deniedBody}
    />
  );
}
