import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArticleCard } from "@/components/ArticleCard";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function Search() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const activeQuery = params.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(activeQuery);
  const { data: results = [], isFetching } = trpc.editorial.search.useQuery({ query: activeQuery }, { enabled: activeQuery.length >= 2 });

  useEffect(() => setQuery(activeQuery), [activeQuery]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    setLocation(next.length >= 2 ? `/pesquisa?q=${encodeURIComponent(next)}` : "/pesquisa");
  }

  return <div className="flex min-h-screen flex-col bg-white"><EditorialHeader /><main className="editorial-shell flex-1 py-8 sm:py-12"><Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 hover:text-black"><ArrowLeft size={14} /> Índice</Link><div className="mt-10 border-t-2 border-black pt-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Arquivo editorial</p><h1 className="mt-3 text-5xl font-black tracking-[-0.075em] sm:text-7xl">Pesquisar</h1><form onSubmit={submit} className="mt-8 flex max-w-3xl border-2 border-black"><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-14 border-0 text-lg shadow-none focus-visible:ring-0" placeholder="Procure por automóvel, tema, autoria ou categoria" aria-label="Termo de pesquisa" /><button type="submit" className="flex w-14 items-center justify-center bg-black text-white transition-colors hover:bg-[#f0372f]" aria-label="Pesquisar"><SearchIcon size={21} /></button></form></div>{activeQuery.length < 2 ? <p className="mt-12 max-w-xl text-lg leading-relaxed text-neutral-600">Escreva pelo menos duas letras para pesquisar nas histórias publicadas, nas autorias e nas categorias.</p> : isFetching ? <p className="mt-12 font-mono text-xs uppercase tracking-[0.13em]">A procurar no arquivo…</p> : <section className="mt-12"><div className="flex items-end justify-between gap-4 border-b border-black pb-3"><h2 className="text-[11px] font-bold uppercase tracking-[0.13em]">Resultados para “{activeQuery}”</h2><span className="font-mono text-[10px] text-neutral-500">{results.length} encontrados</span></div>{results.length ? <div className="mt-8 grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{results.map((article, index) => <ArticleCard key={article.id} article={article} index={index} />)}</div> : <p className="mt-8 text-lg font-semibold tracking-[-0.03em]">Não encontrámos artigos publicados para este termo.</p>}</section>}</main><EditorialFooter /></div>;
}
