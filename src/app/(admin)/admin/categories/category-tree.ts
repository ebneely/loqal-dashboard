/**
 * A category tree, built in the browser from a flat array.
 *
 * BACKEND GAP — AND WHAT IT COSTS.
 *
 * There are two category reads in the backend and this console can call exactly
 * one of them:
 *
 *   `GET /v1/categories`            @AllowAnonymous, calls `listFlat()`, answers
 *                                   a FLAT array. Reachable by anyone.
 *   `GET /v1/dashboard/categories`  calls `getTree()` and answers a real nested
 *                                   tree — and is `@Roles(BRAND_OWNER,
 *                                   BRAND_EMPLOYEE)`. A SUPER_ADMIN session gets
 *                                   403 from it.
 *
 * So the console that OWNS the taxonomy is the one console that cannot read it
 * nested. The nested read exists, it was written for exactly this problem, and
 * it is guarded against the only role allowed to edit the thing. That is the
 * gap; the fix is one decorator, on `catalog.dashboard.controller.ts`, or an
 * `admin/categories` GET on `CategoriesAdminController` — which today has POST,
 * PATCH, PATCH :id/parent, POST reorder and DELETE, and no read at all.
 *
 * WHAT IT COSTS, concretely, rather than as a complaint:
 *
 *  1. Every screen that needs structure rebuilds it. This file is the second
 *     implementation of `buildCategoryTree` in the repo — the first is
 *     `loqal-backend/src/modules/catalog/category-tree.util.ts` — and the two
 *     can drift on exactly the cases below, silently, because neither is tested
 *     against the other.
 *  2. It is an anonymous endpoint, so the admin console's taxonomy read is a
 *     public one. Nothing secret is in it today. It is still a read the admin
 *     plane does not control, and a field added for shoppers arrives here.
 *  3. Deletion counts (`{n} products beneath`) cannot be shown at all: the flat
 *     rows carry no product count, and neither does the tree read. The
 *     confirmation below therefore names WHAT deletion affects without being
 *     able to say HOW MANY, which is a materially weaker warning.
 *
 * THE THREE CASES A NAIVE `filter(c => c.parentId === id)` GETS WRONG, all of
 * which are reachable because the flat array has no integrity guarantee of its
 * own once it leaves the database:
 *
 *  a. An ORPHAN — `parentId` points at a row that is not in the array. It must
 *     still render, at the root, or a whole subtree vanishes from the only
 *     screen that could re-file it.
 *  b. A CYCLE — a → b → a. The service refuses to CREATE one
 *     (`CategoriesAdminService.move` walks ancestors), but a recursive builder
 *     that trusts that assumption hangs the tab rather than showing a broken
 *     row.
 *  c. SELF-PARENTING — `parentId === id`. Same failure, one row instead of two.
 *
 * Pure: no React, no fetch, no DOM.
 */

export type CategoryRow = {
  id: string;
  /** Bilingual JSON on the wire — `{ ar?, en? }`. Resolved by the caller. */
  name: unknown;
  slug: string;
  parentId: string | null;
  sortOrder: number;
};

export type CategoryNode = CategoryRow & {
  depth: number;
  children: CategoryNode[];
  /**
   * True when this row claimed a parent that is not in the response. It is
   * drawn at the root and SAID to be orphaned, rather than quietly reparented —
   * an admin who cannot see that a row lost its parent cannot fix it.
   */
  orphaned: boolean;
};

/** `sortOrder` first, then id — the same order the repository asks Postgres for. */
const inOrder = (a: CategoryRow, b: CategoryRow) =>
  a.sortOrder !== b.sortOrder
    ? a.sortOrder - b.sortOrder
    : a.id < b.id
      ? -1
      : a.id > b.id
        ? 1
        : 0;

export function buildCategoryTree(rows: readonly CategoryRow[]): CategoryNode[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map<string, CategoryRow[]>();
  const roots: CategoryRow[] = [];
  const orphans = new Set<string>();

  for (const row of rows) {
    const parentId = row.parentId;
    // (c) self-parenting, and (a) a parent that is not in the response.
    if (parentId === null || parentId === row.id || !byId.has(parentId)) {
      roots.push(row);
      if (parentId !== null) orphans.add(row.id);
      continue;
    }
    const bucket = children.get(parentId);
    if (bucket) bucket.push(row);
    else children.set(parentId, [row]);
  }

  const visited = new Set<string>();

  /**
   * (b) `seen` is what makes a cycle finite. A row already on the current path
   * is dropped rather than followed, so the tab does not hang.
   */
  const build = (row: CategoryRow, depth: number, seen: Set<string>): CategoryNode => {
    visited.add(row.id);
    const nextSeen = new Set(seen).add(row.id);
    const kids = (children.get(row.id) ?? [])
      .filter((child) => !nextSeen.has(child.id))
      .sort(inOrder)
      .map((child) => build(child, depth + 1, nextSeen));

    return { ...row, depth, children: kids, orphaned: orphans.has(row.id) };
  };

  const tree = roots.sort(inOrder).map((row) => build(row, 0, new Set()));

  /**
   * A pure cycle has NO root at all — a → b → a leaves both rows with a parent
   * that exists, so neither is pushed onto `roots` and a builder that stopped
   * here would answer with an empty tree and silently lose every row in the
   * loop. That is the worst possible outcome on the one screen that could break
   * the loop, so anything still unreached is promoted to a root and marked the
   * same way an orphan is: its parent is not above it in what is drawn.
   */
  for (const row of [...rows].sort(inOrder)) {
    if (visited.has(row.id)) continue;
    orphans.add(row.id);
    tree.push(build(row, 0, new Set()));
  }

  return tree;
}

/** The tree flattened back out, in display order, for a list that indents. */
export function flattenTree(nodes: readonly CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Every id beneath this one, so a move cannot be offered into its own subtree. */
export function descendantIds(node: CategoryNode): string[] {
  return node.children.flatMap((child) => [child.id, ...descendantIds(child)]);
}

/**
 * The siblings of a node, in order — which is exactly what `POST
 * /v1/admin/categories/reorder` wants: a parentId and the ids of everything
 * under it, in the order they should end up.
 */
export function siblingsOf(
  nodes: readonly CategoryNode[],
  parentId: string | null
): CategoryNode[] {
  if (parentId === null) return [...nodes];
  const found = flattenTree(nodes).find((node) => node.id === parentId);
  return found ? [...found.children] : [];
}

/**
 * Move one id one place earlier or later among its siblings, and return the
 * whole sibling order. Returns null when the move is a no-op — the first row
 * cannot move up — so the caller sends no request rather than sending an
 * unchanged list.
 */
export function reorderedSiblings(
  siblings: readonly CategoryNode[],
  id: string,
  direction: -1 | 1
): string[] | null {
  const index = siblings.findIndex((node) => node.id === id);
  if (index === -1) return null;
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return null;

  const ids = siblings.map((node) => node.id);
  const [moved] = ids.splice(index, 1);
  ids.splice(target, 0, moved);
  return ids;
}

/**
 * Reorder by dropping `draggedId` onto `targetId` within one parent. Returns
 * null when the two are not siblings — a drag across levels is a REPARENT, a
 * different operation with a different endpoint, and conflating them is how a
 * category ends up somewhere nobody chose.
 */
export function reorderedByDrop(
  siblings: readonly CategoryNode[],
  draggedId: string,
  targetId: string
): string[] | null {
  const from = siblings.findIndex((node) => node.id === draggedId);
  const to = siblings.findIndex((node) => node.id === targetId);
  if (from === -1 || to === -1 || from === to) return null;

  const ids = siblings.map((node) => node.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  return ids;
}
