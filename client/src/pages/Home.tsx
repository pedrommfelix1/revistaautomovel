import { ArrowRight, CirclePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArticleCard } from "@/components/ArticleCard";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";

const AUTOPLAY_MS = 6000;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Home() {
  const { data: homeSettings } = trpc.settings.home.useQuery();
  const { data: featured = [], isLoading: featuredLoading } = trpc.editorial.featured.useQuery();
  const { data: latest = [] } = trpc.editorial.latest.useQuery({ limit: 9 });
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api || featured.length <= 1) return;
    const interval = setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [api, featured.length]);

  const featuredIds = useMemo(() => new Set(featured.map((article) => article.id)), [featured]);
  // Shuffled once per data load (not every render) so the grid doesn't
  // reorder itself while the carousel above autoplays.
  const following = useMemo(() => shuffle(latest.filter((article) => !featuredIds.has(article.id))), [latest, featuredIds]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="flex-1">
        <section className="editorial-shell py-8 sm:py-12">
          <div className="home-masthead border-b-2 border-black pb-6 sm:pb-8">
            <div><p className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em]"><span className="h-3 w-3 bg-[#f0372f]" /> {homeSettings?.homeKicker}</p><h1 className="max-w-4xl text-5xl font-black leading-[0.82] tracking-[-0.1em] sm:text-7xl lg:text-8xl">{homeSettings?.homeHeadline}</h1></div>
            <p className="max-w-sm self-end text-sm leading-relaxed text-neutral-600">{homeSettings?.homeSubtitle}</p>
          </div>
        </section>

        <section className="editorial-shell">
          <div className="mb-7 flex items-center gap-4"><h2 className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em]"><span className="h-3 w-3 bg-[#f0372f]" /> Em destaque</h2></div>
          {featuredLoading ? (
            <div className="aspect-[16/8] animate-pulse bg-neutral-100" />
          ) : featured.length ? (
            <Carousel opts={{ loop: true }} setApi={setApi}>
              <CarouselContent>
                {featured.map((article) => (
                  <CarouselItem key={article.id}>
                    <ArticleCard article={article} featured />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {featured.length > 1 && (
                // The default carousel arrows center on the whole slide (image +
                // text below), which lands them over the title on mobile once the
                // text pushes the card taller than the photo. This overlay matches
                // ArticleCard's own image aspect ratio, so the arrows always sit at
                // the photo's vertical center regardless of how tall the text is.
                <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[16/9] md:aspect-[16/8]">
                  <CarouselPrevious className="pointer-events-auto left-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-black bg-white text-black hover:bg-black hover:text-white" />
                  <CarouselNext className="pointer-events-auto right-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-black bg-white text-black hover:bg-black hover:text-white" />
                </div>
              )}
            </Carousel>
          ) : (
            <div className="border-y-2 border-black py-14"><p className="text-3xl font-black tracking-[-0.06em]">A próxima história começa na redação.</p><Link href="/redacao" className="mt-7 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-xs font-bold uppercase tracking-[0.12em]">Abrir redação <ArrowRight size={15} /></Link></div>
          )}
        </section>

        <section className="editorial-shell mt-16 sm:mt-24"><div className="mb-7 flex items-center justify-between gap-4 border-t-2 border-black pt-5"><h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">Últimas linhas</h2><Link href="/noticias" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] hover:text-[#f0372f]">Ver arquivo <ArrowRight size={14} /></Link></div>{following.length ? <div className="grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{following.slice(0, 6).map((article, index) => <ArticleCard key={article.id} article={article} index={index + 1} />)}</div> : <p className="text-neutral-500">Novas histórias serão publicadas em breve.</p>}</section>

        <section className="mt-20 bg-[#f0372f] text-white sm:mt-32"><div className="editorial-shell grid gap-8 py-11 sm:grid-cols-[1fr_auto] sm:items-center sm:py-14"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Ferramenta editorial</p><h2 className="mt-2 max-w-2xl text-4xl font-black leading-[0.9] tracking-[-0.075em] sm:text-5xl">Uma história, um campo visual, até cem fotografias.</h2></div><Link href="/redacao" className="inline-flex items-center gap-2 self-start border-2 border-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-white hover:text-black"><CirclePlus size={16} /> Entrar na redação</Link></div></section>
      </main>
      <EditorialFooter />
    </div>
  );
}
