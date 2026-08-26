import type { inferRouterOutputs } from "@trpc/server";
import { ArrowLeft, Clock3, Share2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import type { AppRouter } from "../../../server/routers";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { PhotoGallery } from "@/components/PhotoGallery";
import { useArticleHead } from "@/components/Head";
import { trpc } from "@/lib/trpc";
import { estimateReadingMinutes } from "../../../shared/editorial";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ArticleData = NonNullable<RouterOutputs["editorial"]["bySlug"]>;

function formatFullDate(value: Date | string | null) {
  if (!value) return "Edição Motor de Linha";
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function ArticleBody({ article }: { article: ArticleData }) {
  const openingIndex = article.sections.findIndex((section) => Boolean(section.body));
  return (
    <>
      <div className="article-layout">
        <aside className="article-margin-note"><span>ML / {article.publishedAt ? new Date(article.publishedAt).getFullYear() : "ED"}</span><span>Leitura longa</span></aside>
        <div className="article-copy">
          {article.sections.map((section, index) => {
            if (section.type === "quote") {
              return <figure key={section.id} className="my-12 border-y-2 border-black py-7 sm:my-16 sm:py-9"><blockquote className="text-3xl font-black leading-[0.98] tracking-[-0.055em] sm:text-4xl">“{section.body}”</blockquote>{section.caption && <figcaption className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{section.caption}</figcaption>}</figure>;
            }
            if (section.type === "chapter") {
              // Each chapter opens with its own drop cap, not just the article's first block.
              return <section key={section.id} className="article-chapter"><div className="article-chapter-heading mb-4"><span className="article-chapter-marker" /><h2>{section.heading}</h2></div>{section.body && <p className="drop-cap">{section.body}</p>}{section.caption && <p className="article-caption">{section.caption}</p>}</section>;
            }
            const isOpening = index === openingIndex;
            return <section key={section.id} className="article-paragraph"><p className={isOpening ? "drop-cap" : ""}>{section.body}</p>{section.caption && <p className="article-caption">{section.caption}</p>}</section>;
          })}
        </div>
      </div>
      <div className="article-gallery-wrap"><PhotoGallery images={article.images} /></div>
    </>
  );
}

export default function Article() {
  const [, params] = useRoute("/artigo/:slug");
  const { data: article, isLoading } = trpc.editorial.bySlug.useQuery({ slug: params?.slug ?? "" }, { enabled: Boolean(params?.slug) });
  useArticleHead({ title: article?.seoTitle || article?.title, description: article?.seoDescription || article?.deck, image: article?.socialImageUrl || article?.coverImageUrl, slug: article?.slug });

  if (isLoading) return <div className="min-h-screen bg-white"><EditorialHeader /><div className="editorial-shell py-28 font-mono text-xs uppercase tracking-[0.15em]">A preparar leitura…</div></div>;
  if (!article) return <div className="min-h-screen bg-white"><EditorialHeader /><main className="editorial-shell py-28"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#f0372f]">404 / Artigo indisponível</p><h1 className="mt-4 max-w-xl text-5xl font-black tracking-[-0.07em]">Esta estrada não tem história.</h1><Link href="/" className="mt-8 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold uppercase tracking-[0.1em]"><ArrowLeft size={16} /> Voltar ao início</Link></main><EditorialFooter /></div>;

  const readTime = estimateReadingMinutes(article.sections);
  return (
    <div className="min-h-screen bg-white">
      <EditorialHeader />
      <main>
        <div className="editorial-shell pt-7 sm:pt-11">
          <Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-black"><ArrowLeft size={14} /> Índice</Link>
          <div className="article-hero-grid mt-8 border-t-2 border-black pt-5 sm:mt-11 sm:pt-7">
            <div className="article-title-area">
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-[0.14em]"><span className="text-[#f0372f]">{article.categories.map((category) => category.name).join(" / ") || "Editorial"}</span><span className="text-neutral-500">N.º {String(article.id).padStart(2, "0")}</span></div>
              <h1>{article.title}</h1>
              {article.deck && <p className="article-deck">{article.deck}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-black pt-4 text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
                <span>Por <strong className="text-black">{article.authorName}</strong></span>
                <span>{formatFullDate(article.publishedAt ?? article.createdAt)}</span>
                <span className="flex items-center gap-1.5"><Clock3 size={13} /> {readTime} min</span>
                <button className="ml-auto flex items-center gap-1.5 text-black hover:text-[#f0372f]" aria-label="Partilhar artigo"><Share2 size={13} /> Partilhar</button>
              </div>
            </div>
            <div className="article-cover-area">
              {article.coverImageUrl && <figure><img src={article.coverImageUrl} alt="" className="aspect-[4/3] w-full object-cover" />{article.coverImageCaption && <figcaption className="mt-2 font-mono text-[10px] leading-relaxed text-neutral-500">{article.coverImageCaption}</figcaption>}</figure>}
            </div>
          </div>
        </div>
        <ArticleBody article={article} />
      </main>
      <EditorialFooter />
    </div>
  );
}
