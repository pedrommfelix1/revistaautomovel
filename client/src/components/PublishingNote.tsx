// Same look as the site's small mono-caps labels (font-mono, bold, uppercase,
// wide tracking) — just scaled way up, so the design stays recognizable at a
// headline size instead of switching to the article-title typeface.
export function PublishingNote({ className = "" }: { className?: string }) {
  return (
    <p data-testid="publishing-note" className={`publishing-note-lg text-center font-mono font-bold uppercase tracking-[0.1em] text-neutral-500 ${className}`}>
      Textos todas as <span className="text-black">segundas e quintas</span>
    </p>
  );
}
