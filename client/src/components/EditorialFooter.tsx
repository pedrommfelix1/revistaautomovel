import { Link } from "wouter";

export function EditorialFooter() {
  return (
    <footer className="mt-20 bg-black text-white sm:mt-32">
      <div className="editorial-shell grid gap-10 py-12 sm:grid-cols-[1.3fr_1fr] sm:py-16">
        <div>
          <div className="mb-6 flex items-center gap-3"><span className="h-4 w-4 bg-[#f0372f]" /><span className="text-3xl font-black uppercase tracking-[-0.08em]">Motor de Linha</span></div>
          <p className="max-w-md text-sm leading-relaxed text-white/60">Uma plataforma editorial independente para ler automóveis com tempo, rigor e espaço para a imagem.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-[11px] font-bold uppercase tracking-[0.13em]">
          <Link href="/" className="footer-link">Início</Link>
          <Link href="/noticias" className="footer-link">Notícias</Link>
          <Link href="/multimedia" className="footer-link">Multimédia</Link>
          <Link href="/contactos" className="footer-link">Contactos</Link>
          <Link href="/redacao" className="footer-link">Redação</Link>
        </div>
      </div>
      <div className="border-t border-white/20"><div className="editorial-shell flex flex-wrap justify-between gap-3 py-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50"><span>© 2026 Motor de Linha</span><span>Edição editorial independente</span></div></div>
    </footer>
  );
}
