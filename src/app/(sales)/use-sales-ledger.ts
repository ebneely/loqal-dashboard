"use client";

/**
 * The device ledger, as a hook. The rules it enforces are in
 * `./signed-brands.ts` and have no React in them, on purpose — which shops a
 * rep may act on is the one decision on this console worth testing without a
 * DOM in the way.
 *
 * It is read on mount rather than during render because `sessionStorage` does
 * not exist on the server, and reading it in a render body is what turns a
 * hydration mismatch into a blank screen in a shop.
 */
import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/lib/auth-client";

import {
  EMPTY_LEDGER,
  readLedger,
  writeLedger,
  type SalesLedger,
} from "./signed-brands";

export type SalesLedgerHandle = {
  /** The signed-in rep's id, or "" while the session is still loading. */
  repId: string;
  ledger: SalesLedger;
  /** Applies a pure transform and persists the result under this rep's key. */
  update: (next: (current: SalesLedger) => SalesLedger) => void;
};

export function useSalesLedger(): SalesLedgerHandle {
  const { data: session } = useSession();
  const repId = String(session?.user?.id ?? "");

  const [ledger, setLedger] = useState<SalesLedger>(EMPTY_LEDGER);

  useEffect(() => {
    setLedger(repId ? readLedger(repId) : EMPTY_LEDGER);
  }, [repId]);

  const update = useCallback(
    (next: (current: SalesLedger) => SalesLedger) => {
      setLedger((current) => {
        const updated = next(current);
        if (repId) writeLedger(repId, updated);
        return updated;
      });
    },
    [repId]
  );

  return { repId, ledger, update };
}
