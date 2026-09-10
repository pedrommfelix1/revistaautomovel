import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const mainTabs = [
  { label: "Início", href: "/" },
  { label: "Ensaios", href: "/noticias" },
  { label: "Revista", href: "/revista" },
  { label: "Sobre", href: "/sobre" },
];

export function EditorialHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-black bg-white">
      <div className="editorial-shell flex h-[76px] items-center gap-5">
        <button
          aria-label={open ? "Fechar navegação" : "Abrir navegação"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center border border-black transition-colors hover:bg-black hover:text-white md:hidden"
        >
          {open ? <X size={20} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
        </button>

        <Link href="/" className="flex items-center no-underline text-black" aria-label="Auto Turbo — início">
          <span className="text-2xl font-black uppercase leading-none tracking-[-0.03em] sm:text-3xl">
            <span className="text-[#f0372f]">A</span>uto<span className="text-[#f0372f]">T</span>urbo
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-14">
          <nav aria-label="Navegação principal" className="hidden items-center gap-6 text-[11px] font-bold uppercase tracking-[0.12em] md:flex">
            {mainTabs.map((tab) => <Link key={tab.href} href={tab.href} className="nav-link">{tab.label}</Link>)}
          </nav>

          <Link href="/pesquisa" aria-label="Pesquisar" className="flex h-10 w-10 items-center justify-center border border-black text-black transition-colors hover:bg-black hover:text-white">
            <Search size={19} strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      {open && (
        <nav aria-label="Navegação móvel" className="border-t border-black bg-white px-5 py-5 md:hidden">
          <div className="editorial-shell grid gap-1 px-0">
            {mainTabs.map((tab) => (
              <Link key={tab.href} onClick={() => setOpen(false)} href={tab.href} className="mobile-nav-link">
                <span className="mobile-nav-marker" />{tab.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
