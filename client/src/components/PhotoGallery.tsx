import { ChevronLeft, ChevronRight, Grid2X2, X } from "lucide-react";
import { useEffect, useState } from "react";

type GalleryImage = { id: number; url: string; altText: string | null; caption: string | null; position: number };

export function PhotoGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex === null ? null : images[activeIndex];

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") setActiveIndex((current) => current === null ? null : (current + 1) % images.length);
      if (event.key === "ArrowLeft") setActiveIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, images.length]);

  if (!images.length) return null;

  const previous = () => setActiveIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
  const next = () => setActiveIndex((current) => current === null ? null : (current + 1) % images.length);

  return (
    <section className="mt-16 border-t-2 border-black pt-5 sm:mt-24">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 bg-[#f0372f]" />
          <h2 className="text-xl font-black uppercase tracking-[-0.055em]">Galeria</h2>
        </div>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-500"><Grid2X2 size={14} /> {images.length} imagens</span>
      </div>

      <div className="gallery-grid">
        {images.map((image, index) => (
          <button key={image.id} onClick={() => setActiveIndex(index)} className="group relative block overflow-hidden bg-neutral-100 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
            <img src={image.url} alt={image.altText ?? "Fotografia da galeria"} loading={index > 8 ? "lazy" : "eager"} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            <span className="absolute bottom-0 left-0 bg-white px-2 py-1 font-mono text-[10px] font-bold text-black">{String(index + 1).padStart(2, "0")}</span>
          </button>
        ))}
      </div>

      {active && activeIndex !== null && (
        <div role="dialog" aria-modal="true" aria-label="Visualizador de fotografia" className="fixed inset-0 z-[100] flex bg-black text-white" onClick={() => setActiveIndex(null)}>
          <div className="absolute left-5 top-5 z-10 flex items-center gap-3 font-mono text-[11px] tracking-[0.12em]">
            <span className="h-3 w-3 bg-[#f0372f]" /> {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </div>
          <button onClick={() => setActiveIndex(null)} className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center border border-white/50 transition-colors hover:bg-white hover:text-black" aria-label="Fechar fotografia"><X size={22} /></button>
          <button onClick={(event) => { event.stopPropagation(); previous(); }} className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/50 transition-colors hover:bg-white hover:text-black sm:left-8" aria-label="Imagem anterior"><ChevronLeft size={24} /></button>
          <figure className="flex h-full w-full flex-col items-center justify-center gap-4 px-16 py-20" onClick={(event) => event.stopPropagation()}>
            <img src={active.url} alt={active.altText ?? "Fotografia da galeria"} className="max-h-[76vh] max-w-full object-contain" />
            <figcaption className="max-w-2xl text-center text-sm leading-relaxed text-white/70">{active.caption ?? "Fotografia editorial — Motor de Linha"}</figcaption>
          </figure>
          <button onClick={(event) => { event.stopPropagation(); next(); }} className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/50 transition-colors hover:bg-white hover:text-black sm:right-8" aria-label="Imagem seguinte"><ChevronRight size={24} /></button>
        </div>
      )}
    </section>
  );
}
