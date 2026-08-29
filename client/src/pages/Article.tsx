import type { inferRouterOutputs } from "@trpc/server";
import { ArrowLeft, Clock3, Newspaper, Search, Share2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import type { AppRouter } from "../../../server/routers";
import { ArticleCard } from "@/components/ArticleCard";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { PhotoGallery } from "@/components/PhotoGallery";
import { useArticleHead } from "@/components/Head";
import { trpc } from "@/lib/trpc";
import { estimateReadingMinutes } from "../../../shared/editorial";

const MAGAZINE_MODE_KEY = "motor-de-linha-magazine-mode";

// Persists site-wide (not per-article) so a reader who switches to "modo
// revista" keeps that preference as they browse to other articles.
function useMagazineMode(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(MAGAZINE_MODE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(MAGAZINE_MODE_KEY, enabled ? "1" : "0"); } catch { /* private browsing, etc. */ }
  }, [enabled]);

  return [enabled, () => setEnabled((current) => !current)];
}

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ArticleData = NonNullable<RouterOutputs["editorial"]["bySlug"]>;
type GalleryFrame = { url: string; caption: string | null };

function formatFullDate(value: Date | string | null) {
  if (!value) return "Edição Motor de Linha";
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

// Authors separate paragraphs with line breaks in the editor; a single <p> collapses
// them into one run-on block, so split into one <p> per authored paragraph here.
function splitParagraphs(body: string): string[] {
  return body.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function useRecentArticles(excludeId: number) {
  const { data: recent = [] } = trpc.editorial.latest.useQuery({ limit: 6 });
  return recent.filter((item) => item.id !== excludeId).slice(0, 5);
}

function RecentArticlesList({ items }: { items: { id: number; slug: string; title: string }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="article-sidebar-heading">Artigos recentes</h2>
      <ol className="article-recent-list">
        {items.map((item) => (
          <li key={item.id} className="article-recent-item">
            <span className="article-recent-marker" />
            <Link href={`/artigo/${item.slug}`} className="article-recent-title no-underline">{item.title}</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ArticleSidebar({ article, magazine, activeImage }: { article: ArticleData; magazine: boolean; activeImage: GalleryFrame | null }) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const items = useRecentArticles(article.id);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    if (next.length >= 2) setLocation(`/pesquisa?q=${encodeURIComponent(next)}`);
  }

  const displayImage = activeImage ?? (article.coverImageUrl ? { url: article.coverImageUrl, caption: article.coverImageCaption } : null);

  return (
    <aside className="article-sidebar">
      {displayImage && (
        <figure className="article-cover-area">
          <img key={displayImage.url} src={displayImage.url} alt="" className="w-full h-auto article-cover-fade" />
          {displayImage.caption && <figcaption>{displayImage.caption}</figcaption>}
        </figure>
      )}

      <div className="mt-8">
        <form onSubmit={submitSearch} className="flex border-2 border-black">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar…" aria-label="Pesquisar artigos" className="w-full min-w-0 border-0 px-3 py-2 text-sm outline-none" />
          <button type="submit" aria-label="Pesquisar" className="flex w-10 shrink-0 items-center justify-center bg-black text-white transition-colors hover:bg-[#f0372f]"><Search size={16} /></button>
        </form>

        {/* On mobile "Artigos recentes" moves to the bottom of the page (see ArticleRecentMobile);
            only the sticky desktop rail shows it bundled with the photo and search. Hidden
            entirely in "modo revista", which keeps the rail focused on the photo. */}
        {!magazine && (
          <div className="mt-9 hidden lg:block">
            <RecentArticlesList items={items} />
          </div>
        )}
      </div>
    </aside>
  );
}

function ArticleRecentMobile({ article, magazine }: { article: ArticleData; magazine: boolean }) {
  const items = useRecentArticles(article.id);
  if (magazine || !items.length) return null;
  return (
    <div className="editorial-shell mt-16 border-t-2 border-black pt-7 lg:hidden">
      <RecentArticlesList items={items} />
    </div>
  );
}

function ArticleSections({ article, galleryCount, onActiveImageChange }: { article: ArticleData; galleryCount: number; onActiveImageChange: (index: number) => void }) {
  const openingIndex = article.sections.findIndex((section) => section.type !== "suggested" && Boolean(section.body));
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The sticky photo cycles through the article's gallery as the reader
  // scrolls, in both reading and "modo revista". This tracks continuous
  // scroll progress through the whole body (not per-section) so it steps
  // through every image evenly — with only a handful of sections but many
  // more gallery photos, mapping by section index alone would skip most of them.
  useEffect(() => {
    if (galleryCount <= 1) return;
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    function update() {
      ticking = false;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const triggerLine = window.innerHeight * 0.3;
      const progress = (triggerLine - rect.top) / rect.height;
      const clamped = Math.min(1, Math.max(0, progress));
      onActiveImageChange(Math.min(galleryCount - 1, Math.floor(clamped * galleryCount)));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [galleryCount, onActiveImageChange]);

  return (
    <div className="article-copy" ref={containerRef}>
      {article.sections.map((section, index) => {
        if (section.type === "suggested") {
          const items = section.suggestedArticles ?? [];
          if (!items.length) return null;
          return (
            <aside key={section.id} className="article-suggested">
              <div className="article-suggested-grid">
                {items.map((item, itemIndex) => (
                  <ArticleCard key={item.id} article={item} index={itemIndex} />
                ))}
              </div>
            </aside>
          );
        }
        if (section.type === "quote") {
          return <figure key={section.id} className="my-12 border-y-2 border-black py-7 sm:my-16 sm:py-9"><blockquote className="text-3xl font-black leading-[0.98] tracking-[-0.055em] sm:text-4xl">“{section.body}”</blockquote>{section.caption && <figcaption className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{section.caption}</figcaption>}</figure>;
        }
        if (section.type === "chapter") {
          const isOpening = index === openingIndex;
          const paragraphs = section.body ? splitParagraphs(section.body) : [];
          return <section key={section.id} className="article-chapter"><div className="article-chapter-heading mb-4"><span className="article-chapter-marker" /><h2>{section.heading}</h2></div>{paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className={isOpening && paragraphIndex === 0 ? "drop-cap" : ""}>{paragraph}</p>)}{section.caption && <p className="article-caption">{section.caption}</p>}</section>;
        }
        const isOpening = index === openingIndex;
        const paragraphs = section.body ? splitParagraphs(section.body) : [];
        return <section key={section.id} className="article-paragraph">{paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className={isOpening && paragraphIndex === 0 ? "drop-cap" : ""}>{paragraph}</p>)}{section.caption && <p className="article-caption">{section.caption}</p>}</section>;
      })}
    </div>
  );
}

export default function Article() {
  const [, params] = useRoute("/artigo/:slug");
  const { data: article, isLoading } = trpc.editorial.bySlug.useQuery({ slug: params?.slug ?? "" }, { enabled: Boolean(params?.slug) });
  useArticleHead({ title: article?.seoTitle || article?.title, description: article?.seoDescription || article?.deck, image: article?.socialImageUrl || article?.coverImageUrl, slug: article?.slug });
  const [magazine, toggleMagazine] = useMagazineMode();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const handleActiveImageChange = useCallback((index: number) => setActiveImageIndex(index), []);

  const galleryFrames = useMemo<GalleryFrame[]>(() => {
    if (!article) return [];
    const frames: GalleryFrame[] = [];
    if (article.coverImageUrl) frames.push({ url: article.coverImageUrl, caption: article.coverImageCaption });
    article.images.forEach((image) => frames.push({ url: image.url, caption: image.caption }));
    return frames;
  }, [article]);

  useEffect(() => { setActiveImageIndex(0); }, [article?.id]);

  if (isLoading) return <div className="min-h-screen bg-white"><EditorialHeader /><div className="editorial-shell py-28 font-mono text-xs uppercase tracking-[0.15em]">A preparar leitura…</div></div>;
  if (!article) return <div className="flex min-h-screen flex-col bg-white"><EditorialHeader /><main className="editorial-shell flex-1 py-28"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#f0372f]">404 / Artigo indisponível</p><h1 className="mt-4 max-w-xl text-5xl font-black tracking-[-0.07em]">Esta estrada não tem história.</h1><Link href="/" className="mt-8 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold uppercase tracking-[0.1em]"><ArrowLeft size={16} /> Voltar ao início</Link></main><EditorialFooter /></div>;

  const readTime = estimateReadingMinutes(article.sections);
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="flex-1">
        <div className="editorial-shell pt-7 sm:pt-11">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 transition-colors hover:text-black"><ArrowLeft size={14} /> Índice</Link>
            <button onClick={toggleMagazine} className="inline-flex items-center gap-2 border border-black px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-black hover:text-white">
              <Newspaper size={13} /> {magazine ? "Ver em modo leitura" : "Experimentar modo revista"}
            </button>
          </div>

          <div className={`article-layout mt-8 border-t-2 border-black pt-5 sm:mt-11 sm:pt-7 ${magazine ? "article-layout--magazine" : ""}`}>
            <div className="article-title-area">
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-[0.14em]">{article.categories.length > 0 && <span className="text-[#f0372f]">{article.categories.map((category) => category.name).join(" / ")}</span>}<span className="text-neutral-500">N.º {String(article.id).padStart(2, "0")}</span></div>
              <h1>{article.articleTitle || article.title}</h1>
              {article.deck && <p className="article-deck">{article.deck}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-black pt-4 text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
                <span>Por <strong className="text-black">{article.authorName}</strong></span>
                <span>{formatFullDate(article.publishedAt ?? article.createdAt)}</span>
                <span className="flex items-center gap-1.5"><Clock3 size={13} /> {readTime} min</span>
                <button className="ml-auto flex items-center gap-1.5 text-black hover:text-[#f0372f]" aria-label="Partilhar artigo"><Share2 size={13} /> Partilhar</button>
              </div>
            </div>

            <ArticleSidebar article={article} magazine={magazine} activeImage={galleryFrames[activeImageIndex] ?? null} />
            <ArticleSections article={article} galleryCount={galleryFrames.length} onActiveImageChange={handleActiveImageChange} />
          </div>
        </div>

        <div className="article-gallery-wrap"><PhotoGallery images={article.images} /></div>
        <ArticleRecentMobile article={article} magazine={magazine} />
      </main>
      <EditorialFooter />
    </div>
  );
}
