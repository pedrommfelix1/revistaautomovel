import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { PhotoGallery } from "@/components/PhotoGallery";
import { trpc } from "@/lib/trpc";

export default function Gallery() {
  const { data: images = [], isLoading } = trpc.gallery.list.useQuery();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-11 sm:py-16">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Arquivo visual</p>
        <h1 className="max-w-2xl text-4xl font-black tracking-[-0.07em] sm:text-5xl">Multimédia</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">Um arquivo fotográfico do Motor de Linha, independente dos artigos — até cem imagens editoriais.</p>
        {isLoading ? (
          <p className="mt-12 font-mono text-xs uppercase tracking-[0.13em] text-neutral-500">A carregar fotografias…</p>
        ) : images.length ? (
          <PhotoGallery images={images} />
        ) : (
          <div className="mt-12 border border-dashed border-black p-7"><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">A galeria ainda não tem fotografias.</p></div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
