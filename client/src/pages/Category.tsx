import { ArrowLeft } from "lucide-react";
import { Link, useRoute } from "wouter";
import { ArticleCard } from "@/components/ArticleCard";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";

export default function Category() {
  const [, params] = useRoute("/categoria/:slug");
  const { data: categories = [] } = trpc.editorial.categories.useQuery();
  const category = categories.find((item) => item.slug === params?.slug);
  const { data: articles = [], isLoading } = trpc.editorial.byCategory.useQuery({ slug: params?.slug ?? "" }, { enabled: Boolean(params?.slug) });
  return <div className="flex min-h-screen flex-col bg-white"><EditorialHeader /><main className="editorial-shell flex-1 py-8 sm:py-12"><Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 hover:text-black"><ArrowLeft size={14} /> Índice</Link><div className="mt-10 border-t-2 border-black pt-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Arquivo de categoria</p><h1 className="mt-3 text-5xl font-black tracking-[-0.075em] sm:text-7xl">{category?.name ?? "Categoria"}</h1>{category?.description && <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600">{category.description}</p>}</div>{isLoading ? <p className="mt-16 font-mono text-xs uppercase tracking-[0.14em]">A carregar artigos…</p> : articles.length ? <div className="mt-14 grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{articles.map((article, index) => <ArticleCard key={article.id} article={article} index={index} />)}</div> : <div className="mt-16 border-t border-black pt-5"><p className="text-lg font-semibold">Ainda não há histórias publicadas nesta categoria.</p></div>}</main><EditorialFooter /></div>;
}
