"use client";

/** The route file, and nothing else. The shop's own codes — the shop pays. */
import { useMessages } from "@/lib/locale-context";

import { PromoCodesScreen } from "./promo-codes-screen";
import { SHOP_PROMO_PATH } from "./promo-codes-data";

export default function PromoCodesPage() {
  const p = useMessages().brand.promo;
  return (
    <PromoCodesScreen
      path={SHOP_PROMO_PATH}
      note={p.shopNote}
      requiredRole="BRAND_OWNER"
      deniedTitle={p.deniedTitle}
      deniedBody={p.deniedBody}
    />
  );
}
