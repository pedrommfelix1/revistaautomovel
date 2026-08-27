import { ArticleCard } from "@/components/ArticleCard";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";

export default function News() {
  const { data: categories = [] } = trpc.editorial.categories.useQuery();
  const { data: articles = [], isLoading } = trpc.editorial.all.useQuery();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const tipos = categories.filter((category) => category.kind === "tipo");
  const marcas = categories.filter((category) => category.kind === "marca");

  const filtered = useMemo(() => {
    if (!activeCategory) return articles;
    return articles.filter((article) => article.categories.some((category) => category.slug === activeCategory));
  }, [articles, activeCategory]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-8 sm:py-12">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Arquivo editorial</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.075em] sm:text-7xl">Notícias</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">Todas as histórias publicadas no Motor de Linha, por ordem de publicação.</p>

        {categories.length > 0 && (
          <div className="mt-8 space-y-4 border-t border-black pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setActiveCategory(null)} className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${activeCategory === null ? "border-black bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}`}>Todas</button>
            </div>
            {tipos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Tipo:</span>
                {tipos.map((category) => (
                  <button key={category.id} onClick={() => setActiveCategory(category.slug)} className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${activeCategory === category.slug ? "border-black bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}`}>{category.name}</button>
                ))}
              </div>
            )}
            {marcas.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Marca:</span>
                {marcas.map((category) => (
                  <button key={category.id} onClick={() => setActiveCategory(category.slug)} className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${activeCategory === category.slug ? "border-black bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}`}>{category.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <p className="mt-12 font-mono text-xs uppercase tracking-[0.13em] text-neutral-500">A carregar notícias…</p>
        ) : filtered.length ? (
          <div className="mt-12 grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((article, index) => <ArticleCard key={article.id} article={article} index={index} />)}
          </div>
        ) : (
          <div className="mt-12 border-t border-black pt-5"><p className="text-lg font-semibold">Ainda não há histórias publicadas nesta categoria.</p></div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
