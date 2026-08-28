export type EditorialSectionType = "paragraph" | "chapter" | "quote" | "suggested";

export function toEditorialSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 170);
}

export function estimateReadingMinutes(blocks: Array<{ body?: string | null }>): number {
  const words = blocks
    .map((block) => block.body ?? "")
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

export function sectionLabel(type: EditorialSectionType): string {
  const labels: Record<EditorialSectionType, string> = {
    paragraph: "Texto",
    chapter: "Capítulo",
    quote: "Citação",
    suggested: "Sugestões",
  };

  return labels[type];
}

export function canManageEditorialArticle(user: { id: number; role: "admin" | "user" }, authorId: number | null): boolean {
  return user.role === "admin" || user.id === authorId;
}

export function isPublicEditorialStatus(status: "draft" | "published"): boolean {
  return status === "published";
}

export function reorderEditorialItems<T extends { position: number }>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, index) => ({ ...item, position: index }));
}
