import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { reorderEditorialItems } from "../../../shared/editorial";
import { GripVertical, Save, Upload, X } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type GalleryEditorImage = { url: string; storageKey: string | null; altText: string | null; caption: string | null; position: number };

async function compressedDataUrl(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      element.src = imageUrl;
    });
    const maxDimension = 2600;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível otimizar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function GalleryEditor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const listQuery = trpc.gallery.list.useQuery();
  const saveImages = trpc.gallery.manage.save.useMutation();
  const uploadImage = trpc.gallery.manage.uploadImage.useMutation();

  const [images, setImages] = useState<GalleryEditorImage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!listQuery.data || loaded) return;
    setImages(listQuery.data.map((image) => ({ url: image.url, storageKey: image.storageKey, altText: image.altText, caption: image.caption, position: image.position })));
    setLoaded(true);
  }, [listQuery.data, loaded]);

  function updateImage(index: number, patch: Partial<GalleryEditorImage>) { setImages((items) => items.map((item, current) => current === index ? { ...item, ...patch } : item)); }
  function removeImage(index: number) { setImages((items) => items.filter((_, current) => current !== index).map((image, current) => ({ ...image, position: current }))); }
  function reorderImages(from: number, to: number) { setImages((items) => reorderEditorialItems(items, from, to)); }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um ficheiro de imagem."); return; }
    if (images.length >= 100) { toast.error("A galeria do site suporta até 100 imagens."); return; }
    setUploading(true);
    try {
      const dataUrl = await compressedDataUrl(file);
      const asset = await uploadImage.mutateAsync({ dataUrl, fileName: file.name });
      setImages((current) => [...current, { url: asset.url, storageKey: asset.key, altText: file.name.replace(/\.[^/.]+$/, ""), caption: "", position: current.length }]);
      toast.success("Imagem adicionada. Guarde para persistir a ordem e a legenda.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    try {
      await saveImages.mutateAsync({ images });
      await listQuery.refetch();
      toast.success("Galeria do site guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar a galeria.");
    }
  }

  if (!isAdmin) {
    return <DashboardLayout><div className="mx-auto max-w-6xl py-14"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Acesso restrito</p><p className="mt-4 text-sm leading-relaxed text-neutral-600">Apenas administradores podem gerir a galeria do site.</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-12">
        <div className="flex flex-col gap-5 border-b-2 border-black pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Multimédia</h1>
            <p className="mt-2 text-xs text-neutral-500">{images.length}/100 imagens · independente dos artigos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={images.length >= 100 ? "pointer-events-none opacity-40" : ""}>
              <span className="editor-add inline-flex"><Upload size={13} /> {uploading ? "A preparar…" : "Adicionar imagens"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleUpload(event)} className="sr-only" disabled={images.length >= 100 || uploading} />
            </label>
            <Button onClick={() => void handleSave()} disabled={saveImages.isPending || uploading} className="h-10 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-black"><Save size={14} /> {saveImages.isPending ? "A guardar…" : "Guardar"}</Button>
          </div>
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Arraste para ordenar. Estas fotografias aparecem apenas na página pública /multimedia.</p>

        <div className="mt-6">
          {listQuery.isLoading ? (
            <p className="py-12 font-mono text-xs uppercase tracking-[0.13em]">A carregar galeria…</p>
          ) : images.length ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {images.map((image, index) => (
                <div key={`${image.url}-${index}`} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex !== null && draggedIndex !== index) reorderImages(draggedIndex, index); setDraggedIndex(null); }} onDragEnd={() => setDraggedIndex(null)} className={`border border-black p-3 transition-opacity ${draggedIndex === index ? "opacity-40" : ""}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                    <img src={image.url} alt="Pré-visualização" className="h-full w-full object-cover" />
                    <button type="button" className="absolute left-2 top-2 flex h-7 w-7 cursor-grab items-center justify-center bg-white text-black active:cursor-grabbing" aria-label={`Arrastar imagem ${index + 1}`}><GripVertical size={15} /></button>
                    <button onClick={() => removeImage(index)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-white text-black hover:bg-[#f0372f] hover:text-white" aria-label="Remover imagem"><X size={15} /></button>
                    <span className="absolute bottom-0 left-0 bg-white px-2 py-1 font-mono text-[10px] font-bold">{String(index + 1).padStart(3, "0")}</span>
                  </div>
                  <Input value={image.altText ?? ""} onChange={(event) => updateImage(index, { altText: event.target.value })} className="editor-input mt-3 text-xs" placeholder="Descrição alternativa" />
                  <Textarea value={image.caption ?? ""} onChange={(event) => updateImage(index, { caption: event.target.value })} className="editor-input mt-3 min-h-20 text-xs" placeholder="Legenda da fotografia" />
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-black p-7"><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">A galeria do site ainda não tem fotografias. Adicione até cem imagens com texto alternativo e legenda individuais.</p></div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
