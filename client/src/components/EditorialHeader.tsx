import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const mainTabs = [
  { label: "Notícias", href: "/noticias" },
  { label: "Multimédia", href: "/multimedia" },
  { label: "Revista", href: "/revista" },
  { label: "Sobre", href: "/sobre" },
];

export function EditorialHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-black bg-white">
      <div className="editorial-shell flex h-[76px] items-center justify-between gap-5">
        <button
          aria-label={open ? "Fechar navegação" : "Abrir navegação"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center border border-black transition-colors hover:bg-black hover:text-white md:hidden"
        >
          {open ? <X size={20} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
        </button>

        <Link href="/" className="group flex items-center gap-3 no-underline text-black" aria-label="Motor de Linha — início">
          <span className="h-4 w-4 bg-[#f0372f] transition-transform duration-200 group-hover:rotate-45" />
          <span className="leading-[0.8] tracking-[-0.09em]">
            <span className="block text-[10px] font-bold uppercase tracking-[0.38em]">Motor</span>
            <span className="block text-[27px] font-black uppercase tracking-[-0.105em]">de Linha</span>
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-6 text-[11px] font-bold uppercase tracking-[0.12em] md:flex">
          {mainTabs.map((tab) => <Link key={tab.href} href={tab.href} className="nav-link">{tab.label}</Link>)}
          <Link href="/redacao" className="nav-link">Redação</Link>
        </nav>

        <Link href="/pesquisa" aria-label="Pesquisar" className="flex h-10 w-10 items-center justify-center border border-black text-black transition-colors hover:bg-black hover:text-white">
          <Search size={19} strokeWidth={1.8} />
        </Link>
      </div>

      {open && (
        <nav aria-label="Navegação móvel" className="border-t border-black bg-white px-5 py-5 md:hidden">
          <div className="editorial-shell grid gap-1 px-0">
            {mainTabs.map((tab) => (
              <Link key={tab.href} onClick={() => setOpen(false)} href={tab.href} className="mobile-nav-link">
                <span className="mobile-nav-marker" />{tab.label}
              </Link>
            ))}
            <Link onClick={() => setOpen(false)} href="/redacao" className="mobile-nav-link"><span className="mobile-nav-marker" />Redação</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
