"use client";

/**
 * /products — the shop's catalogue, drafts included.
 *
 * Composed from the domain layer: ResponsiveList (card stack below md, real
 * table at md and up), StatusPill, ListState — plus shadcn's Button, Input,
 * NativeSelect and Card.
 *
 * The decision this screen exists to get right: a DRAFT has no name and no
 * price, and both are legitimately null. Neither is rendered as an empty cell
 * and neither is rendered as `0.00`. A zero price that reaches a storefront
 * costs a shop real money, which is why the contract makes "unset"
 * representable instead of faking it — and why this screen says "no price yet"
 * in words and offers the one action that fixes it.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ProductStatusSchema } from "@loqal/contracts/enums";
import type { ProductStatus } from "@loqal/contracts/enums";

import {
  ListState,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { useCategories, useProducts } from "./catalog-data";
import {
  displayName,
  matchesSearch,
  productGaps,
  type CatalogProduct,
} from "./catalog-wire";

const STATUSES: readonly ProductStatus[] = ProductStatusSchema.options;

const isStatus = (value: string | null): value is ProductStatus =>
  value !== null && (STATUSES as readonly string[]).includes(value);

export function ProductsScreen() {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get("status");
  const status = isStatus(rawStatus) ? rawStatus : null;
  const categoryId = params.get("category");

  const [search, setSearch] = useState("");

  const feed = useProducts({ status, categoryId });
  const categories = useCategories();

  const rows = useMemo(
    () => feed.rows.filter((product) => matchesSearch(product, search)),
    [feed.rows, search]
  );

  /** Drafts still missing a name or a price — the only backlog on this screen. */
  const needsAttention = useMemo(
    () => feed.rows.filter((product) => productGaps(product).length > 0),
    [feed.rows]
  );

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: feed.rows.length === 0,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `/products?${query}` : "/products");
  };

  /**
   * A missing name is still a row a shop owner has to be able to open, so the
   * link is always there and it always says something. "Needs a name" is a
   * sentence; a blank cell is a bug the reader has to guess at.
   */
  const nameCell = (product: CatalogProduct) => {
    const name = displayName(product.name, locale);
    return (
      <Link
        href={`/products/${product.id}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
        data-testid={`product-name-${product.id}`}
        data-unset={name === null ? "name" : undefined}
      >
        {name ?? (
          <span className="text-state-act-fg">{b.needsName}</span>
        )}
      </Link>
    );
  };

  /**
   * Never 0.00 and never blank.
   *
   * `basePrice` is null when nobody has typed one. Formatting null as zero is
   * how a shop gives its stock away; leaving the cell empty is how the shop
   * never notices.
   */
  const priceCell = (product: CatalogProduct) =>
    product.basePrice === null ? (
      <span className="text-state-act-fg" data-testid={`product-price-${product.id}`}>
        {b.needsPrice}
      </span>
    ) : (
      <span data-testid={`product-price-${product.id}`}>
        {formatMoney(product.basePrice)}
      </span>
    );

  const columns: readonly ResponsiveListColumn<CatalogProduct>[] = [
    { key: "name", header: b.product, cell: nameCell, primary: true },
    {
      key: "status",
      header: b.status,
      cell: (product) => (
        <StatusPill
          kind="ProductStatus"
          value={product.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    { key: "price", header: b.price, cell: priceCell, numeric: true },
    {
      key: "variants",
      header: b.variants,
      cell: (product) => String(product.variantCount),
      numeric: true,
    },
    {
      key: "priceFrom",
      header: b.priceFrom,
      cell: (product) =>
        product.priceFrom === null ? "—" : formatMoney(product.priceFrom),
      numeric: true,
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <section aria-label={b.filterStatus} className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-2">
          <label
            htmlFor="products-status-filter"
            className="text-sm font-medium text-foreground"
          >
            {b.filterStatus}
          </label>
          <NativeSelect
            id="products-status-filter"
            value={status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <NativeSelectOption value="">{b.filterAll}</NativeSelectOption>
            {STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel({ kind: "ProductStatus", value }, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="products-category-filter"
            className="text-sm font-medium text-foreground"
          >
            {b.filterCategory}
          </label>
          <NativeSelect
            id="products-category-filter"
            value={categoryId ?? ""}
            onChange={(event) => setParam("category", event.target.value)}
          >
            <NativeSelectOption value="">{b.allCategories}</NativeSelectOption>
            {(categories.data ?? []).map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {(locale === "ar" ? category.name.ar : category.name.en) ??
                  category.slug}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="products-search"
            className="text-sm font-medium text-foreground"
          >
            {b.searchLabel}
          </label>
          <Input
            id="products-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {/* Said out loud because it is true: there is no search parameter on
              the products endpoint, so this narrows what is already loaded. */}
          <p className="text-xs text-muted-foreground">{b.searchNote}</p>
        </div>
      </section>

      {needsAttention.length > 0 && state === null ? (
        <section aria-label={b.needsAttention} data-testid="products-needs-attention">
          <Card className="border-state-act-border bg-state-act-bg/30 shadow-none">
            <CardHeader className="gap-1">
              <CardTitle className="text-base">
                {b.needsAttention.replace("{n}", String(needsAttention.length))}
              </CardTitle>
              <CardDescription>{b.noPriceNote}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="min-h-11">
                <Link href="/products/bulk">{b.finishDrafts}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section aria-label={b.nav.products} className="grid gap-3">
        {state === "loading" ? <ListState state="loading" rows={4} /> : null}

        {state === "error" ? (
          <ListState
            state="error"
            title={b.productsErrorTitle}
            body={b.errorBody}
            actionLabel={b.retry}
            onAction={feed.reload}
          />
        ) : null}

        {/* Denied gets no retry: pressing it again changes nothing. */}
        {state === "denied" ? (
          <ListState
            state="denied"
            title={b.catalogOnlyTitle}
            body={b.catalogOnlyBody}
            requiredRole="BRAND_OWNER"
          />
        ) : null}

        {/*
          The way out of an empty catalog is an ADDRESS, so it is an anchor —
          keyboard-reachable, middle-clickable, copyable. `actionHref` is what
          ListState grew for exactly this.
        */}
        {state === "empty" ? (
          <ListState
            state="empty"
            title={b.productsEmptyTitle}
            body={b.productsEmptyBody}
            actionLabel={b.addPhotos}
            actionHref="/products/bulk"
          />
        ) : null}

        {state === null ? (
          rows.length === 0 ? (
            <ListState
              state="empty"
              title={b.searchNoMatchTitle}
              body={b.searchNoMatchBody}
            />
          ) : (
            <>
              <ResponsiveList
                rows={rows}
                columns={columns}
                getRowKey={(product) => product.id}
                caption={b.nav.products}
              />
              <p className="text-xs text-muted-foreground">
                {b.showingCount
                  .replace("{n}", String(rows.length))
                  .replace("{total}", String(feed.total))}
              </p>
            </>
          )
        ) : null}
      </section>
    </div>
  );
}
