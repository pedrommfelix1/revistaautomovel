import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

type CardArticle = {
  id: number;
  title: string;
  slug: string;
  deck: string | null;
  coverImageUrl: string | null;
  authorName: string;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  categories: Array<{ id: number; name: string; slug: string }>;
};

function formatDate(value: Date | string | null) {
  if (!value) return "Edição recente";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(value))
    .replace(" de ", " ");
}

export function ArticleCard({ article, featured = false, index = 0 }: { article: CardArticle; featured?: boolean; index?: number }) {
  return (
    <article className={`group flex h-full flex-col ${featured ? "featured-card" : "article-card"}`}>
      <Link href={`/artigo/${article.slug}`} className="block overflow-hidden bg-[#e9e9e7]">
        {article.coverImageUrl ? (
          <img src={article.coverImageUrl} alt="" className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] ${featured ? "aspect-[16/9] md:aspect-[16/8]" : "aspect-[4/3]"}`} />
        ) : <div className="aspect-[4/3] bg-[#e9e9e7]" />}
      </Link>
      <div className={`flex flex-1 flex-col ${featured ? "pt-5" : "border-t border-black pt-4"}`}>
        <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.13em]">
          {article.categories.length > 0 && <span className="text-[#f0372f]">{article.categories.map((category) => category.name).join(" / ")}</span>}
          <span className="ml-auto font-mono font-normal text-neutral-500">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <Link href={`/artigo/${article.slug}`} className="group/title no-underline text-black">
          <h3 className={`${featured ? "text-4xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-3xl"} max-w-4xl font-black leading-[0.94] tracking-[-0.065em]`}>{article.title}</h3>
        </Link>
        {article.deck && <p className={`${featured ? "max-w-2xl text-base sm:text-lg" : "text-sm"} mt-4 leading-relaxed text-neutral-600 ${featured ? "" : "line-clamp-3"}`}>{article.deck}</p>}
        <div className="mt-auto flex items-center justify-between gap-4 border-t border-black/20 pt-3 text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
          <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
          <Link href={`/artigo/${article.slug}`} aria-label={`Ler ${article.title}`} className="flex items-center gap-1 text-black transition-transform group-hover:translate-x-1">
            Ler <ArrowUpRight size={14} strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </article>
  );
}
