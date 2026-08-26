import { describe, expect, it } from "vitest";
import { canManageEditorialArticle, estimateReadingMinutes, isPublicEditorialStatus, reorderEditorialItems, sectionLabel, toEditorialSlug } from "../shared/editorial";

describe("editorial content helpers", () => {
  it("creates stable Portuguese-friendly slugs", () => {
    expect(toEditorialSlug("  A paixão pelo automóvel: edição 2026! ")).toBe("a-paixao-pelo-automovel-edicao-2026");
  });

  it("always reports at least one reading minute", () => {
    expect(estimateReadingMinutes([{ body: "Breve nota." }])).toBe(1);
  });

  it("provides the correct authoring label for a pull quote", () => {
    expect(sectionLabel("quote")).toBe("Citação");
  });

  it("allows an author to manage only their own article", () => {
    expect(canManageEditorialArticle({ id: 12, role: "user" }, 12)).toBe(true);
    expect(canManageEditorialArticle({ id: 12, role: "user" }, 99)).toBe(false);
    expect(canManageEditorialArticle({ id: 12, role: "user" }, null)).toBe(false);
  });

  it("allows an administrator to manage any article", () => {
    expect(canManageEditorialArticle({ id: 12, role: "admin" }, 99)).toBe(true);
    expect(canManageEditorialArticle({ id: 12, role: "admin" }, null)).toBe(true);
  });

  it("does not expose drafts in public editorial queries", () => {
    expect(isPublicEditorialStatus("draft")).toBe(false);
    expect(isPublicEditorialStatus("published")).toBe(true);
  });

  it("reorders editorial blocks while normalising stored positions", () => {
    const reordered = reorderEditorialItems([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ], 2, 0);

    expect(reordered).toEqual([
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });
});
