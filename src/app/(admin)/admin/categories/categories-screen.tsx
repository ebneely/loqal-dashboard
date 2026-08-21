"use client";

/**
 * /admin/categories — the global taxonomy.
 *
 * Composed from the domain layer: ListState, DestructiveSheet — plus shadcn's
 * Card, Button, Input, Label, Alert and NativeSelect.
 *
 * CATEGORIES ARE ADMIN-OWNED, and the model says so: `Category` has no
 * `brandId` (migration 20260809180000_admin_owned_categories) and `BrandCategory`
 * is the join. A brand maps INTO the shared taxonomy; it never invents a
 * category. That is the whole reason this screen exists in the admin console
 * and nowhere else, and it is why "Home & Living" means the same thing on every
 * storefront page rather than forty things.
 *
 * DRAG ON A DESKTOP, BUTTONS EVERYWHERE.
 *
 * Reordering by drag is the right gesture with a mouse and is unusable with a
 * thumb — a 44px row, a scrolling page and a long-press that the browser reads
 * as a text selection. So the up/down controls are not a fallback that appears
 * below md; they are ALWAYS rendered, at every width, and the drag handlers are
 * added on top for pointers that can use them. One control set, one code path,
 * one order — a drag and a button press send the identical request.
 *
 * DELETION IS THE DANGEROUS ONE, and not for the obvious reason.
 * See the sheet at the bottom of this file.
 */
import { useMemo, useState } from "react";

import { DestructiveSheet, ListState, listStateFor } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";
import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";

import {
  categoryName,
  createCategory,
  deleteCategory,
  isCreatable,
  moveCategory,
  reorderCategories,
  updateCategory,
  useCategories,
} from "./categories-data";
import {
  buildCategoryTree,
  descendantIds,
  flattenTree,
  reorderedByDrop,
  reorderedSiblings,
  siblingsOf,
  type CategoryNode,
} from "./category-tree";

export function CategoriesScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();

  const resource = useCategories();

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleting, setDeleting] = useState<CategoryNode | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const tree = useMemo(
    () => buildCategoryTree(resource.data ?? []),
    [resource.data]
  );
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const state = listStateFor(resource.error, {
    isLoading: resource.isLoading,
    isEmpty: flat.length === 0,
  });

  const label = (node: CategoryNode) =>
    categoryName(node.name, locale) || node.slug;

  const run = async (work: () => Promise<unknown>) => {
    setPending(true);
    setFailed(null);
    try {
      await work();
      resource.reload();
      return true;
    } catch (thrown) {
      // The service refuses a cycle and refuses a delete that would orphan
      // rows, both with a 409 carrying a sentence. Showing the API's own words
      // beats a generic failure — "That move would create a cycle in the
      // category tree" is actionable and "Something went wrong" is not.
      setFailed(
        thrown instanceof Error && thrown.message ? thrown.message : a.saveFailed
      );
      return false;
    } finally {
      setPending(false);
    }
  };

  const move = (node: CategoryNode, direction: -1 | 1) => {
    const siblings = siblingsOf(tree, node.parentId);
    const ordered = reorderedSiblings(siblings, node.id, direction);
    if (!ordered) return;
    void run(() => reorderCategories(node.parentId, ordered));
  };

  const drop = (target: CategoryNode) => {
    if (!dragging || dragging === target.id) return;
    const source = flat.find((node) => node.id === dragging);
    setDragging(null);
    // A drag across levels is a REPARENT, a different operation with a
    // different endpoint. Silently turning one into the other is how a category
    // ends up somewhere nobody chose.
    if (!source || source.parentId !== target.parentId) return;
    const ordered = reorderedByDrop(
      siblingsOf(tree, target.parentId),
      dragging,
      target.id
    );
    if (!ordered) return;
    void run(() => reorderCategories(target.parentId, ordered));
  };

  /** Everything except this node and its own descendants — a cycle by hand. */
  const parentOptions = (node: CategoryNode) => {
    const forbidden = new Set([node.id, ...descendantIds(node)]);
    return flat.filter((candidate) => !forbidden.has(candidate.id));
  };

  const row = (node: CategoryNode) => (
    <Card
      key={node.id}
      className=""
      draggable
      data-category-id={node.id}
      data-depth={node.depth}
      onDragStart={() => setDragging(node.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => drop(node)}
      onDragEnd={() => setDragging(null)}
    >
      <CardContent
        className="flex flex-wrap items-center gap-2 px-4 py-3"
        // Inline, not a `ps-*` utility: the indent is data-driven per row and a
        // logical property flips itself, so this is correct in both directions.
        style={{ paddingInlineStart: `${16 + node.depth * 20}px` }}
      >
        {renaming === node.id ? (
          <>
            <Input
              aria-label={a.renameTitle}
              className="w-full max-w-xs"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <Button
              size="sm"
              disabled={pending || renameValue.trim() === ""}
              onClick={() =>
                void run(async () => {
                  // One language is enough — `bilingualSchema` requires at
                  // least one and never both, because a both-required rule
                  // makes taxonomy entry unfinishable. The rename writes the
                  // language the console is being read in.
                  await updateCategory(node.id, {
                    name:
                      locale === "ar"
                        ? { ar: renameValue.trim() }
                        : { en: renameValue.trim() },
                  });
                  setRenaming(null);
                })
              }
            >
              {a.saveName}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRenaming(null)}
            >
              {a.cancel}
            </Button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {label(node)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {node.slug}
            </span>
            {node.orphaned ? (
              <span className="text-xs text-state-bad-fg">{a.orphaned}</span>
            ) : null}

            {/* Always present, at every width. */}
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${a.moveUp}: ${label(node)}`}
              disabled={pending}
              onClick={() => move(node, -1)}
            >
              {a.moveUp}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${a.moveDown}: ${label(node)}`}
              disabled={pending}
              onClick={() => move(node, 1)}
            >
              {a.moveDown}
            </Button>

            <NativeSelect
              aria-label={`${a.move}: ${label(node)}`}
              className="w-40"
              size="sm"
              value={node.parentId ?? ""}
              onChange={(event) =>
                void run(() =>
                  moveCategory(node.id, event.target.value || null)
                )
              }
            >
              <NativeSelectOption value="">{a.noParent}</NativeSelectOption>
              {parentOptions(node).map((candidate) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {label(candidate)}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRenameValue(label(node));
                setRenaming(node.id);
              }}
            >
              {a.rename}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setDeleting(node)}
            >
              {a.deleteAction}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.categoriesNote}</p>

      <Alert>
        <AlertTitle>{a.flatListTitle}</AlertTitle>
        <AlertDescription>{a.flatListBody}</AlertDescription>
      </Alert>

      <Card className="">
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name-en">{a.categoryNameEn}</Label>
            <Input
              id="category-name-en"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-name-ar">{a.categoryNameAr}</Label>
            <Input
              id="category-name-ar"
              value={nameAr}
              onChange={(event) => setNameAr(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-slug">{a.categorySlug}</Label>
            <Input
              id="category-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-parent">{a.parent}</Label>
            <NativeSelect
              id="category-parent"
              className="w-full"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <NativeSelectOption value="">{a.noParent}</NativeSelectOption>
              {flat.map((node) => (
                <NativeSelectOption key={node.id} value={node.id}>
                  {label(node)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="md:col-span-4">
            <Button
              className="min-h-11"
              disabled={pending || !isCreatable({ nameEn, nameAr, slug })}
              onClick={() =>
                void run(async () => {
                  await createCategory({
                    name: {
                      ...(nameEn.trim() ? { en: nameEn.trim() } : {}),
                      ...(nameAr.trim() ? { ar: nameAr.trim() } : {}),
                    },
                    slug: slug.trim(),
                    parentId: parentId || null,
                  });
                  setNameEn("");
                  setNameAr("");
                  setSlug("");
                  setParentId("");
                })
              }
            >
              {a.createCategory}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {a.oneLanguageEnough}
            </p>
          </div>
        </CardContent>
      </Card>

      {failed ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {failed}
        </p>
      ) : null}

      {state === "loading" ? <ListState state="loading" rows={5} /> : null}

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
          title={a.categoriesEmptyTitle}
          body={a.categoriesEmptyBody}
        />
      ) : null}

      {state === null ? (
        <div className="grid gap-2" data-testid="category-tree">
          {flat.map(row)}
        </div>
      ) : null}

      {/*
        DELETING A REFERENCED CATEGORY IS A LIVE DEFECT, and the confirmation
        has to carry that rather than dress it up.
        The foreign key is ON DELETE SET NULL, so a delete that reaches the
        database silently blanks `categoryId` on every product filed beneath it
        — the products survive, uncategorised, and nothing anywhere records what
        they used to be. A migration to RESTRICT is pending. Until it lands, the
        ONLY thing standing between an admin and that outcome is a service-level
        guard that counts products and children and throws a 409 first.
        A guard is not a constraint: it holds for this route and not for a
        script, a console session or a second controller. So the sheet says what
        deletion affects in words, and the count is deliberately absent because
        neither category read returns one — an unknown count stated as unknown
        is honest; a "0" nobody counted is not.
      */}
      <DestructiveSheet
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={a.deleteTitle}
        description={deleting ? label(deleting) : undefined}
        consequences={[
          a.deleteAffectsProducts,
          a.deleteAffectsChildren,
          a.deleteGuardOnly,
        ]}
        confirmLabel={a.deleteAction}
        cancelLabel={a.keepCategory}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await run(() => deleteCategory(deleting.id));
          if (ok) setDeleting(null);
        }}
      />
    </div>
  );
}
