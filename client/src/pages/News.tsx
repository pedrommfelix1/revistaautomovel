import { ArticleCard } from "@/components/ArticleCard";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";

export default function News() {
  const { data: categories = [] } = trpc.editorial.categories.useQuery();
  const { data: articles = [], isLoading } = trpc.editorial.all.useQuery();
  const [activeTipo, setActiveTipo] = useState<string | null>(null);
  const [activeMarca, setActiveMarca] = useState<string | null>(null);
  const tipos = categories.filter((category) => category.kind === "tipo");
  const marcas = categories.filter((category) => category.kind === "marca");

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      const matchesTipo = !activeTipo || article.categories.some((category) => category.slug === activeTipo);
      const matchesMarca = !activeMarca || article.categories.some((category) => category.slug === activeMarca);
      return matchesTipo && matchesMarca;
    });
  }, [articles, activeTipo, activeMarca]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-8 sm:py-12">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Arquivo editorial</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.075em] sm:text-7xl">Notícias</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">Todas as histórias publicadas no Motor de Linha, por ordem de publicação.</p>

        {categories.length > 0 && (
          <div className="mt-8 grid gap-4 border-t border-black pt-5 sm:grid-cols-2 sm:max-w-lg">
            <div>
              <label htmlFor="tipo-filter" className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Tipo de carro</label>
              <select
                id="tipo-filter"
                value={activeTipo ?? ""}
                onChange={(event) => setActiveTipo(event.target.value || null)}
                className="w-full border-2 border-black bg-white px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] outline-none"
              >
                <option value="">Todos</option>
                {tipos.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="marca-filter" className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Marca</label>
              <select
                id="marca-filter"
                value={activeMarca ?? ""}
                onChange={(event) => setActiveMarca(event.target.value || null)}
                className="w-full border-2 border-black bg-white px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] outline-none"
              >
                <option value="">Todas</option>
                {marcas.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
              </select>
            </div>
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
