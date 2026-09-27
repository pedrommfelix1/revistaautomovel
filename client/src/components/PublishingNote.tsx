// Styled like the article H1 (see .article-title-area h1 / .publishing-note
// in index.css) rather than the small mono labels elsewhere on these pages —
// this is meant to read as a headline-weight statement, not a caption.
export function PublishingNote({ className = "" }: { className?: string }) {
  return (
    <p data-testid="publishing-note" className={`publishing-note ${className}`}>
      Textos todas as segundas e quintas
    </p>
  );
}
