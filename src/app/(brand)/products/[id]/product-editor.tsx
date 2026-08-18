"use client";

/**
 * /products/[id] — one product, in both languages.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, ListState,
 * DestructiveSheet — plus shadcn's Tabs, Field, Input, Textarea, NativeSelect,
 * Card and Button.
 *
 * Three rules run through the whole screen:
 *
 *  a. AT LEAST ONE language, never both. A both-required rule makes catalog
 *     entry unfinishable, which is the entire reason the bulk flow exists. The
 *     check lives in `upsertProductBodySchema`, so this screen refuses the same
 *     bodies the API would.
 *  b. A variant carries its OWN sku, price and stock. Size XL may legitimately
 *     cost more than S, so the price is not a product-level number the variants
 *     inherit.
 *  c. ARCHIVE, never delete. A past order references this product forever, and
 *     editing it must never change what that order says was bought — which is
 *     what the confirmation sheet says, in those words.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { moneySchema } from "@loqal/contracts/contracts";

import {
  DestructiveSheet,
  ListState,
  ResponsiveList,
  StatusPill,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { useCategories, useProduct, useProductWrite } from "../catalog-data";
import {
  productGaps,
  type CatalogVariant,
  type ProductGap,
} from "../catalog-wire";

type Draft = {
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  basePrice: string;
  categoryId: string;
};

const EMPTY: Draft = {
  nameEn: "",
  nameAr: "",
  descEn: "",
  descAr: "",
  basePrice: "",
  categoryId: "",
};

const trimmed = (value: string) => value.trim();

/** `{ ar?, en? }`, with an absent language absent rather than an empty string. */
const bilingualFrom = (ar: string, en: string) => {
  const body: { ar?: string; en?: string } = {};
  if (trimmed(ar)) body.ar = trimmed(ar);
  if (trimmed(en)) body.en = trimmed(en);
  return body;
};

export function ProductEditor({ id }: { id: string }) {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();

  const resource = useProduct(id);
  const categories = useCategories();
  const write = useProductWrite(id);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const product = resource.product;

  useEffect(() => {
    if (!product) return;
    setDraft({
      nameEn: product.name?.en ?? "",
      nameAr: product.name?.ar ?? "",
      descEn: product.description?.en ?? "",
      descAr: product.description?.ar ?? "",
      basePrice: product.basePrice ?? "",
      categoryId: product.categoryId ?? "",
    });
    setTouched(false);
  }, [product]);

  /**
   * `notFound` is opt-in and this is a detail route, so it opts in. The API
   * answers 404 rather than 403 for another shop's product on purpose — so the
   * address is not an enumeration oracle — and this screen must not undo that
   * by wording the two differently.
   */
  const state = listStateFor(resource.error, {
    isLoading: resource.isLoading,
    notFound: true,
  });

  const hasOneLanguage = Boolean(
    trimmed(draft.nameAr) || trimmed(draft.nameEn)
  );
  const priceIsMalformed =
    trimmed(draft.basePrice).length > 0 &&
    !moneySchema.safeParse(trimmed(draft.basePrice)).success;

  const gaps: ProductGap[] = useMemo(
    () =>
      product
        ? productGaps(product)
        : [],
    [product]
  );

  const canSave = hasOneLanguage && !priceIsMalformed && !write.pending;

  const save = async () => {
    setTouched(true);
    if (!canSave) return;
    const body: Record<string, unknown> = {
      name: bilingualFrom(draft.nameAr, draft.nameEn),
    };
    const description = bilingualFrom(draft.descAr, draft.descEn);
    if (description.ar || description.en) body.description = description;
    // Only ever sent when it is a real amount. Sending null would be a 400 —
    // `basePrice` is a NOT NULL column and its update DTO has no null arm — and
    // sending "0.00" to clear a field would put a free item on a storefront.
    if (trimmed(draft.basePrice)) body.basePrice = trimmed(draft.basePrice);
    body.categoryId = draft.categoryId ? draft.categoryId : null;

    const ok = await write.save(body);
    setSaved(ok);
    if (ok) resource.reload();
  };

  const publish = async () => {
    if (!product || gaps.length > 0) return;
    if (await write.setStatus("ACTIVE")) resource.reload();
  };

  const archive = async () => {
    if (await write.setStatus("ARCHIVED")) {
      setArchiving(false);
      resource.reload();
    }
  };

  const variantColumns: readonly ResponsiveListColumn<CatalogVariant>[] = [
    {
      key: "sku",
      header: b.sku,
      cell: (variant) => <span className="font-mono">{variant.sku}</span>,
      primary: true,
    },
    {
      key: "attributes",
      header: b.attributesField,
      cell: (variant) => {
        const pairs = Object.entries(variant.attributes);
        return pairs.length === 0
          ? "—"
          : pairs.map(([key, value]) => `${key}: ${value}`).join(" · ");
      },
      meta: true,
    },
    {
      key: "price",
      header: b.price,
      // Its own price, not the product's. An XL may cost more than an S.
      cell: (variant) => formatMoney(variant.price),
      numeric: true,
    },
    {
      key: "stock",
      header: b.onHand,
      cell: (variant) => String(variant.stockOnHand),
      numeric: true,
    },
    {
      key: "inventory",
      header: b.nav.inventory,
      cell: (variant) => (
        <Link
          href={`/inventory?variant=${variant.id}`}
          className="text-sm underline-offset-4 hover:underline"
        >
          {b.available}
        </Link>
      ),
      tableOnly: true,
    },
  ];

  if (state === "loading") return <ListState state="loading" rows={3} />;

  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={b.catalogOnlyTitle}
        body={b.catalogOnlyBody}
        requiredRole="BRAND_OWNER"
      />
    );
  }

  if (state === "notFound") {
    return (
      <ListState
        state="notFound"
        title={b.productNotFoundTitle}
        body={b.productNotFoundBody}
        actionLabel={b.nav.products}
        actionHref="/products"
      />
    );
  }

  if (state === "error" || !product) {
    return (
      <ListState
        state="error"
        title={b.productErrorTitle}
        body={b.errorBody}
        actionLabel={b.retry}
        onAction={resource.reload}
      />
    );
  }

  const isArchived = product.status === "ARCHIVED";

  return (
    <div className="grid gap-6">
      <section aria-label={b.product} className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill
            kind="ProductStatus"
            value={product.status}
            locale={locale}
          />
          <span className="text-xs text-muted-foreground">
            {b.mediaCount.replace("{n}", String(product.mediaCount))}
          </span>
        </div>

        {gaps.length > 0 ? (
          <Card
            className="border-state-act-border bg-state-act-bg/30 shadow-none"
            data-testid="product-gaps"
          >
            <CardHeader className="gap-1">
              <CardTitle className="text-base">{b.needsAttentionOne}</CardTitle>
              <CardDescription>
                {gaps.includes("price") ? b.publishNoPrice : b.publishNoName}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {isArchived ? (
          <p className="text-sm text-muted-foreground">{b.archivedNote}</p>
        ) : null}
      </section>

      <section aria-label={b.nameField} className="grid gap-3">
        <Tabs defaultValue={locale === "ar" ? "ar" : "en"}>
          <TabsList>
            <TabsTrigger value="en">{b.english}</TabsTrigger>
            <TabsTrigger value="ar">{b.arabic}</TabsTrigger>
          </TabsList>

          <TabsContent value="en" className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="product-name-en">{b.nameEn}</FieldLabel>
              <Input
                id="product-name-en"
                value={draft.nameEn}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, nameEn: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-desc-en">{b.descEn}</FieldLabel>
              <Textarea
                id="product-desc-en"
                value={draft.descEn}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, descEn: event.target.value }))
                }
              />
            </Field>
          </TabsContent>

          <TabsContent value="ar" className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="product-name-ar">{b.nameArabic}</FieldLabel>
              <Input
                id="product-name-ar"
                dir="rtl"
                value={draft.nameAr}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, nameAr: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-desc-ar">{b.descArabic}</FieldLabel>
              <Textarea
                id="product-desc-ar"
                dir="rtl"
                value={draft.descAr}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, descAr: event.target.value }))
                }
              />
            </Field>
          </TabsContent>
        </Tabs>

        {/* One language is enough. Both is better. Neither is not allowed. */}
        <p className="text-xs text-muted-foreground">{b.oneLangRequired}</p>
        {touched && !hasOneLanguage ? (
          <p role="alert" className="text-sm text-destructive">
            {b.oneLangRequired}
          </p>
        ) : null}
      </section>

      {/* The landmark and the field are deliberately named differently: two
          elements answering to the same accessible name make "the price field"
          ambiguous to anything navigating by label. */}
      <section aria-label={b.priceField} className="grid gap-3 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="product-base-price">{b.basePrice}</FieldLabel>
          <Input
            id="product-base-price"
            inputMode="decimal"
            value={draft.basePrice}
            onChange={(event) =>
              setDraft((d) => ({ ...d, basePrice: event.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">{b.basePriceNote}</p>
          {priceIsMalformed ? (
            <p role="alert" className="text-sm text-destructive">
              {b.priceMalformed}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="product-category">{b.categoryField}</FieldLabel>
          <NativeSelect
            id="product-category"
            value={draft.categoryId}
            onChange={(event) =>
              setDraft((d) => ({ ...d, categoryId: event.target.value }))
            }
          >
            <NativeSelectOption value="">{b.noCategory}</NativeSelectOption>
            {(categories.data ?? []).map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {(locale === "ar" ? category.name.ar : category.name.en) ??
                  category.slug}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </section>

      <section aria-label={b.variants} className="grid gap-3">
        <h2 className="text-base font-semibold text-foreground">{b.variants}</h2>
        <p className="text-sm text-muted-foreground">{b.variantNote}</p>
        {product.variants.length === 0 ? (
          <ListState
            state="empty"
            title={b.noVariants}
            body={b.noVariantsNote}
          />
        ) : (
          <ResponsiveList
            rows={product.variants}
            columns={variantColumns}
            getRowKey={(variant) => variant.id}
            caption={b.variants}
          />
        )}
      </section>

      <section aria-label={b.save} className="grid gap-3">
        {write.failed ? (
          <p role="alert" className="text-sm text-destructive">
            {b.saveFailed}
          </p>
        ) : null}
        {saved && !write.failed ? (
          <p className="text-sm text-muted-foreground">{b.savedOk}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            className="min-h-12"
            disabled={write.pending}
            onClick={() => void save()}
          >
            {write.pending ? b.saving : b.save}
          </Button>

          {product.status === "DRAFT" ? (
            <Button
              variant="outline"
              className="min-h-12"
              disabled={gaps.length > 0 || write.pending}
              onClick={() => void publish()}
            >
              {b.publish}
            </Button>
          ) : null}

          {!isArchived ? (
            <DestructiveSheet
              open={archiving}
              onOpenChange={setArchiving}
              trigger={
                <Button variant="outline" className="min-h-12 text-destructive">
                  {b.archiveAction}
                </Button>
              }
              title={b.archiveTitle}
              description={b.archiveNote}
              /*
                Required by the component and load-bearing here: the reason a
                brand is allowed to archive rather than delete is that a past
                order must keep saying what was actually bought. That is the
                sentence a shop owner needs before they press.
              */
              consequences={[
                b.conseqArchivedHidden,
                b.conseqArchivedKept,
                b.conseqArchivedFinal,
              ]}
              confirmLabel={b.archiveConfirm}
              cancelLabel={b.cancel}
              onConfirm={archive}
            />
          ) : null}
        </div>

        {gaps.length > 0 && product.status === "DRAFT" ? (
          <p className="text-xs text-muted-foreground">{b.publishBlockedHint}</p>
        ) : null}
      </section>
    </div>
  );
}
