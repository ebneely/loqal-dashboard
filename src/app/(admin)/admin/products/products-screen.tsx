"use client";

/**
 * /admin/products — every brand's catalog, and the one control that overrides
 * a shop's own decision.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, ListState,
 * DestructiveSheet — plus shadcn's Alert, Button, Input and NativeSelect.
 *
 * THE OVERRIDE IS BEHIND A SHEET THAT SAYS WHAT IT DOES. Archiving a product
 * from here beats the shop's own status setting and skips the normal
 * draft-to-active-to-archived ladder entirely, because a policy violation has
 * to be archivable from any state. That is three surprising facts, so they are
 * three sentences in the sheet rather than a tooltip.
 *
 * NOTHING IS EVER DELETED. Past orders reference a product forever, and the
 * snapshot they froze is what a dispute is settled from.
 *
 * The paging banner and the two sentinel cells are not decoration — see
 * `products-data.ts` for what this endpoint actually sends.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ProductStatusSchema, type ProductStatus } from "@loqal/contracts/enums";

import {
  DestructiveSheet,
  ListState,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import {
  PER_PAGE,
  clampPage,
  isProductStatus,
  overrideProductStatus,
  pageCount,
  priceOf,
  productName,
  readPage,
  useAdminProducts,
  type AdminProductRow,
} from "./products-data";

const STATUSES: readonly ProductStatus[] = ProductStatusSchema.options;

export function ProductsScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get("status");
  const status = isProductStatus(rawStatus) ? rawStatus : null;
  const brandId = params.get("brandId") ?? "";
  const page = readPage(params.get("page"));

  const resource = useAdminProducts(page, status, brandId);

  const [target, setTarget] = useState<AdminProductRow | null>(null);
  const [nextStatus, setNextStatus] = useState<ProductStatus>("ARCHIVED");
  const [failed, setFailed] = useState(false);

  const data = resource.data;
  const rows = data?.items ?? [];

  const state = listStateFor(resource.error, {
    isLoading: resource.isLoading,
    isEmpty: rows.length === 0,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Any filter change resets to the first page: page 4 of the old filter is
    // not page 4 of the new one, and landing on an empty page reads as a bug.
    if (key !== "page") next.delete("page");
    const query = next.toString();
    router.replace(query ? `/admin/products?${query}` : "/admin/products");
  };

  const total = data?.total ?? 0;
  const pages = pageCount(total, data?.perPage ?? PER_PAGE);
  const current = clampPage(page, total, data?.perPage ?? PER_PAGE);

  const applyOverride = async () => {
    if (!target) return;
    setFailed(false);
    try {
      await overrideProductStatus(target.id, nextStatus);
      setTarget(null);
      resource.reload();
    } catch {
      setFailed(true);
    }
  };

  const columns: readonly ResponsiveListColumn<AdminProductRow>[] = [
    {
      key: "name",
      header: a.product,
      cell: (row) => {
        const name = productName(row, locale);
        return name ?? (
          <span className="text-muted-foreground">{a.notNamed}</span>
        );
      },
      primary: true,
    },
    {
      key: "brand",
      header: a.brand,
      cell: (row) => row.brand.name,
      meta: true,
    },
    {
      key: "status",
      header: a.status,
      cell: (row) => (
        <StatusPill
          kind="ProductStatus"
          value={row.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "price",
      header: a.price,
      cell: (row) => {
        const price = priceOf(row);
        return price ? (
          formatMoney(price)
        ) : (
          /* `-1` is a sentinel for a photo-only draft nobody priced. Printing
             it beside a currency symbol would be worse than a blank. */
          <span className="text-muted-foreground">{a.notPriced}</span>
        );
      },
      numeric: true,
    },
    {
      key: "override",
      header: a.overrideStatus,
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTarget(row);
            setNextStatus(row.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED");
          }}
        >
          {a.overrideAction}
        </Button>
      ),
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertTitle>{a.offsetPagedTitle}</AlertTitle>
        <AlertDescription>{a.offsetPagedBody}</AlertDescription>
      </Alert>

      <p className="text-sm text-muted-foreground">{a.moderationNote}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label
            htmlFor="admin-products-status"
            className="text-sm font-medium text-foreground"
          >
            {a.filterStatus}
          </label>
          <NativeSelect
            id="admin-products-status"
            className="w-full max-w-xs"
            value={status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
            {STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel({ kind: "ProductStatus", value }, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="admin-products-brand"
            className="text-sm font-medium text-foreground"
          >
            {a.filterBrandId}
          </label>
          <Input
            id="admin-products-brand"
            className="w-full max-w-xs"
            defaultValue={brandId}
            placeholder={a.filterBrandIdPlaceholder}
            onBlur={(event) => setParam("brandId", event.target.value.trim())}
          />
          <p className="max-w-xs text-xs text-muted-foreground">
            {a.filterBrandIdHint}
          </p>
        </div>
      </div>

      {state === "loading" ? <ListState state="loading" rows={4} /> : null}

      {state === "error" ? (
        <ListState
          state="error"
          title={a.errorTitle}
          body={a.errorBody}
          actionLabel={a.retry}
          onAction={resource.reload}
        />
      ) : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={a.deniedTitle}
          body={a.deniedBody}
          requiredRole={ADMIN_REQUIRED_ROLE}
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={a.productsEmptyTitle}
          body={a.productsEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            caption={a.productsCaption}
          />

          <p className="text-sm text-muted-foreground">
            {a.productRowTotal.replace("{n}", String(total))}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={current <= 1}
              onClick={() => setParam("page", String(current - 1))}
            >
              {a.previousPage}
            </Button>
            <span className="text-sm text-muted-foreground">
              {a.pageOf
                .replace("{n}", String(current))
                .replace("{total}", String(pages))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pages}
              onClick={() => setParam("page", String(current + 1))}
            >
              {a.nextPage}
            </Button>
          </div>

          {/* The phone card has no room for the override button, so it lives
              under the list where the card stack can still reach it. */}
          <div className="grid gap-2 md:hidden">
            {rows.map((row) => (
              <Button
                key={row.id}
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => {
                  setTarget(row);
                  setNextStatus(row.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED");
                }}
              >
                {a.overrideAction}: {productName(row, locale) ?? row.slug}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      {failed ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {a.actionFailed}
        </p>
      ) : null}

      {target ? (
        <DestructiveSheet
          open
          onOpenChange={(open) => {
            if (!open) setTarget(null);
          }}
          title={a.overrideTitle}
          description={a.overrideDesc}
          consequences={[
            a.overrideBeatsBrand,
            a.overrideNoLadder,
            a.overrideNeverDeletes,
          ]}
          confirmLabel={a.overrideAction}
          cancelLabel={a.keepProduct}
          onConfirm={applyOverride}
        >
          <div className="grid gap-2">
            <label
              htmlFor="override-status"
              className="text-sm font-medium text-foreground"
            >
              {a.chooseStatus}
            </label>
            <NativeSelect
              id="override-status"
              value={nextStatus}
              onChange={(event) =>
                setNextStatus(event.target.value as ProductStatus)
              }
            >
              {STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {statusLabel({ kind: "ProductStatus", value }, locale)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </DestructiveSheet>
      ) : null}
    </div>
  );
}
