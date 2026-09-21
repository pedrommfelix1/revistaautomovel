// Two lines on phones so it fits beside "Em destaque" / "Índice" on one row;
// a single line from the sm breakpoint up.
export function PublishingNote({ className = "" }: { className?: string }) {
  return (
    <p data-testid="publishing-note" className={`text-right font-mono text-xs font-bold uppercase leading-snug tracking-[0.1em] text-neutral-500 sm:text-left lg:text-[15px] ${className}`}>
      Textos todas as <span className="block text-black sm:inline">segundas e quintas</span>
    </p>
  );
}
