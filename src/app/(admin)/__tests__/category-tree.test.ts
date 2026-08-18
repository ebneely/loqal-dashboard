// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildCategoryTree,
  descendantIds,
  flattenTree,
  reorderedByDrop,
  reorderedSiblings,
  siblingsOf,
} from "../admin/categories/category-tree";
import { cyclicCategories, flatCategories, orphanedCategory } from "./fixtures";

describe("the tree is built from a flat array", () => {
  it("nests by parentId and keeps two roots apart", () => {
    const tree = buildCategoryTree(flatCategories);

    expect(tree.map((node) => node.slug)).toEqual(["home", "fashion"]);
    expect(tree[0].children.map((node) => node.slug)).toEqual(["kitchen"]);
    expect(tree[0].children[0].children.map((node) => node.slug)).toEqual([
      "mugs",
      "plates",
    ]);
  });

  it("records the depth every row is drawn at", () => {
    const flat = flattenTree(buildCategoryTree(flatCategories));
    const depths = Object.fromEntries(
      flat.map((node) => [node.slug, node.depth])
    );

    expect(depths).toEqual({
      home: 0,
      kitchen: 1,
      mugs: 2,
      plates: 2,
      fashion: 0,
    });
  });

  it("orders siblings by sortOrder, not by the order they arrived", () => {
    // `mugs` has sortOrder 0 and arrives AFTER `plates` in the array.
    const tree = buildCategoryTree(flatCategories);
    expect(tree[0].children[0].children[0].slug).toBe("mugs");
  });

  it("keeps an orphan visible, at the root, and says it is one", () => {
    // Losing a subtree because its parent was filtered out upstream would hide
    // the rows from the only screen that could re-file them.
    const tree = buildCategoryTree([...flatCategories, orphanedCategory]);
    const orphan = tree.find((node) => node.slug === "orphaned");

    expect(orphan).toBeDefined();
    expect(orphan?.depth).toBe(0);
    expect(orphan?.orphaned).toBe(true);
    expect(tree.filter((node) => node.orphaned)).toHaveLength(1);
  });

  it("survives a cycle instead of recursing forever", () => {
    const tree = buildCategoryTree(cyclicCategories);
    const flat = flattenTree(tree);

    // Both rows are reachable, and neither is drawn inside itself.
    expect(flat.length).toBeGreaterThanOrEqual(2);
    expect(flat.length).toBeLessThan(10);
    expect(new Set(tree.map((node) => node.id)).size).toBe(tree.length);
  });

  it("treats a row that claims itself as its own parent as a root", () => {
    const tree = buildCategoryTree([
      { id: "x", name: { en: "X" }, slug: "x", parentId: "x", sortOrder: 0 },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(0);
  });

  it("draws nothing from nothing", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});

describe("moving and reordering", () => {
  const tree = buildCategoryTree(flatCategories);

  it("names every descendant, so a move into a subtree is never offered", () => {
    expect(descendantIds(tree[0]).sort()).toEqual(
      ["c-kitchen", "c-mugs", "c-plates"].sort()
    );
  });

  it("returns the whole sibling order, which is what the endpoint wants", () => {
    const siblings = siblingsOf(tree, "c-kitchen");
    expect(siblings.map((node) => node.id)).toEqual(["c-mugs", "c-plates"]);

    expect(reorderedSiblings(siblings, "c-plates", -1)).toEqual([
      "c-plates",
      "c-mugs",
    ]);
  });

  it("refuses a move that would change nothing rather than sending it", () => {
    const siblings = siblingsOf(tree, "c-kitchen");
    expect(reorderedSiblings(siblings, "c-mugs", -1)).toBeNull();
    expect(reorderedSiblings(siblings, "c-plates", 1)).toBeNull();
    expect(reorderedSiblings(siblings, "not-here", 1)).toBeNull();
  });

  it("reorders by drop within one parent", () => {
    const siblings = siblingsOf(tree, "c-kitchen");
    expect(reorderedByDrop(siblings, "c-plates", "c-mugs")).toEqual([
      "c-plates",
      "c-mugs",
    ]);
  });

  it("refuses a drop onto a row that is not a sibling", () => {
    // A drag across levels is a REPARENT, a different endpoint. Conflating the
    // two is how a category ends up somewhere nobody chose.
    const siblings = siblingsOf(tree, "c-kitchen");
    expect(reorderedByDrop(siblings, "c-plates", "c-fashion")).toBeNull();
    expect(reorderedByDrop(siblings, "c-plates", "c-plates")).toBeNull();
  });

  it("reads the root's own siblings", () => {
    expect(siblingsOf(tree, null).map((node) => node.id)).toEqual([
      "c-home",
      "c-fashion",
    ]);
  });
});
