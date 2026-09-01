import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TagMultiSelect } from "@/components/TagMultiSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { reorderEditorialItems } from "../../../shared/editorial";
import { ArrowLeft, Check, ChevronDown, GripVertical, ImageUp, Plus, Save, Send, Trash2, Upload, X } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";

type EditorSection = { type: "paragraph" | "chapter" | "quote" | "suggested" | "image"; heading: string | null; body: string | null; caption: string | null; position: number };
type PickableArticle = { id: number; title: string; status: "draft" | "published" };

// "suggested" sections store their picks as a comma-separated list of article
// ids in `body` (see server/db.ts parseSuggestedArticleIds) — no new table,
// consistent with how every other section type already just repurposes the
// same handful of text columns.
function SuggestedArticlesPicker({ section, onChange, allArticles, excludeId }: { section: EditorSection; onChange: (body: string) => void; allArticles: PickableArticle[]; excludeId: number }) {
  const [search, setSearch] = useState("");
  const selectedIds = (section.body ?? "").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
  const results = search.trim().length >= 2
    ? allArticles.filter((item) => item.id !== excludeId && !selectedIds.includes(item.id) && item.title.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6)
    : [];

  function addArticle(id: number) {
    if (selectedIds.length >= 3) { toast.error("Máximo de 3 sugestões por bloco."); return; }
    onChange([...selectedIds, id].join(","));
    setSearch("");
  }
  function removeArticle(id: number) {
    onChange(selectedIds.filter((value) => value !== id).join(","));
  }

  return (
    <div>
      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const found = allArticles.find((item) => item.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1.5 border border-black px-2 py-1 text-xs">
                {found?.title ?? `Artigo #${id}`}
                {found && found.status !== "published" && <span className="text-neutral-400">(rascunho)</span>}
                <button type="button" onClick={() => removeArticle(id)} aria-label="Remover sugestão"><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}
      {selectedIds.length < 3 && (
        <div className="relative">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="editor-input" placeholder="Procurar um artigo para sugerir…" />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full border border-black bg-white shadow-lg">
              {results.map((item) => (
                <button key={item.id} type="button" onClick={() => addArticle(item.id)} className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100">
                  {item.title} {item.status !== "published" && <span className="text-neutral-400">(rascunho)</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">{selectedIds.length}/3 sugestões · só artigos publicados aparecem para os leitores.</p>
    </div>
  );
}
type EditorImage = { url: string; storageKey: string | null; altText: string | null; caption: string | null; position: number };
type EditorMetadata = { title: string; articleTitle: string | null; slug: string; deck: string | null; authorName: string; coverImageUrl: string | null; coverImageCaption: string | null; seoTitle: string | null; seoDescription: string | null; socialImageUrl: string | null; isFeatured: boolean };

const emptyMetadata: EditorMetadata = { title: "", articleTitle: "", slug: "", deck: "", authorName: "", coverImageUrl: null, coverImageCaption: "", seoTitle: "", seoDescription: "", socialImageUrl: null, isFeatured: false };

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

export default function ArticleEditor() {
  const [, params] = useRoute("/redacao/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const routeId = params?.id ?? "";
  const articleId = Number(routeId);
  const isNew = routeId === "novo";
  const { data: categories = [] } = trpc.editorial.categories.useQuery();
  const { data: allArticles = [] } = trpc.editorial.manage.list.useQuery();
  const detailQuery = trpc.editorial.manage.detail.useQuery({ id: articleId }, { enabled: Boolean(user) && Number.isInteger(articleId) && articleId > 0 });
  const createArticle = trpc.editorial.manage.create.useMutation({ onSuccess: (article) => { if (article) setLocation(`/redacao/${article.id}`); }, onError: (error) => toast.error(error.message) });
  const saveMetadata = trpc.editorial.manage.saveMetadata.useMutation();
  const saveSections = trpc.editorial.manage.saveSections.useMutation();
  const saveImages = trpc.editorial.manage.saveImages.useMutation();
  const saveCategories = trpc.editorial.manage.saveCategories.useMutation();
  const publishArticle = trpc.editorial.manage.publish.useMutation();
  const uploadImage = trpc.editorial.manage.uploadImage.useMutation();
  const createCategory = trpc.editorial.manage.createCategory.useMutation();
  const deleteDraft = trpc.editorial.manage.deleteDraft.useMutation({
    onSuccess: async () => { setDeleteDialogOpen(false); await utils.editorial.manage.list.invalidate(); setLocation("/redacao"); },
    onError: (error) => { setDeleteDialogOpen(false); toast.error(error.message); },
  });

  const [metadata, setMetadata] = useState<EditorMetadata>(emptyMetadata);
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [images, setImages] = useState<EditorImage[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const article = detailQuery.data;

  useEffect(() => {
    if (!isNew || !user || createArticle.isPending) return;
    createArticle.mutate({ title: "Sem título" });
  }, [isNew, user, createArticle]);

  useEffect(() => {
    if (!article || article.id === loadedId) return;
    setMetadata({ title: article.title, articleTitle: article.articleTitle, slug: article.slug, deck: article.deck, authorName: article.authorName, coverImageUrl: article.coverImageUrl, coverImageCaption: article.coverImageCaption, seoTitle: article.seoTitle, seoDescription: article.seoDescription, socialImageUrl: article.socialImageUrl, isFeatured: article.isFeatured });
    setSections(article.sections.map((section) => ({ type: section.type, heading: section.heading, body: section.body, caption: section.caption, position: section.position })));
    setImages(article.images.map((image) => ({ url: image.url, storageKey: image.storageKey, altText: image.altText, caption: image.caption, position: image.position })));
    setCategoryIds(article.categories.map((category) => category.id));
    setLoadedId(article.id);
  }, [article, loadedId]);

  const isSaving = saveMetadata.isPending || saveSections.isPending || saveImages.isPending || saveCategories.isPending;
  const articleStatus = article?.status ?? "draft";
  const readLabel = useMemo(() => `${sections.length} blocos · ${images.length}/10 imagens`, [sections.length, images.length]);
  const socialPreviewTitle = metadata.seoTitle?.trim() || metadata.title || "Título do artigo";
  const socialPreviewDescription = metadata.seoDescription?.trim() || metadata.deck?.trim() || "Descrição para a pré-visualização social.";
  const socialPreviewImage = metadata.socialImageUrl || metadata.coverImageUrl;

  function updateSection(index: number, patch: Partial<EditorSection>) { setSections((items) => items.map((item, current) => current === index ? { ...item, ...patch } : item)); }
  function removeSection(index: number) { setSections((items) => items.filter((_, current) => current !== index).map((item, current) => ({ ...item, position: current }))); }
  function addSection(type: EditorSection["type"]) { setSections((items) => [...items, { type, heading: type === "chapter" ? "Novo capítulo" : null, body: "", caption: type === "quote" ? "Fonte ou nota" : null, position: items.length }]); }
  function updateImage(index: number, patch: Partial<EditorImage>) { setImages((items) => items.map((item, current) => current === index ? { ...item, ...patch } : item)); }
  function removeImage(index: number) { setImages((items) => items.filter((_, current) => current !== index).map((image, current) => ({ ...image, position: current }))); }
  function reorderSections(from: number, to: number) { setSections((items) => reorderEditorialItems(items, from, to)); }
  function reorderImages(from: number, to: number) { setImages((items) => reorderEditorialItems(items, from, to)); }

  async function saveAll(showToast = true) {
    if (!article) return;
    if (!metadata.title.trim() || !metadata.authorName.trim()) { toast.error("Indique um título e o nome da autoria antes de guardar."); return; }
    try {
      await saveMetadata.mutateAsync({ id: article.id, ...metadata, title: metadata.title.trim(), articleTitle: metadata.articleTitle?.trim() || null, slug: metadata.slug.trim() || metadata.title.trim() });
      await saveSections.mutateAsync({ id: article.id, sections });
      await saveImages.mutateAsync({ id: article.id, images });
      await saveCategories.mutateAsync({ id: article.id, categoryIds });
      await detailQuery.refetch();
      if (showToast) toast.success("Alterações guardadas.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível guardar as alterações."); }
  }

  async function handlePublish(nextStatus: boolean) {
    if (!article) return;
    await saveAll(false);
    try {
      await publishArticle.mutateAsync({ id: article.id, published: nextStatus });
      await detailQuery.refetch();
      toast.success(nextStatus ? "Artigo publicado." : "Artigo devolvido a rascunho.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar o estado."); }
  }

  async function handleDeleteDraft() {
    if (!article || article.status !== "draft") return;
    await deleteDraft.mutateAsync({ id: article.id });
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>, target: "cover" | "gallery" | "social") {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !article) return;
    if (files.some((file) => !file.type.startsWith("image/"))) { toast.error("Selecione apenas ficheiros de imagem."); return; }

    let toUpload = files;
    if (target === "gallery") {
      const remaining = 10 - images.length;
      if (remaining <= 0) { toast.error("Cada artigo suporta até 10 imagens na galeria. Use a multimédia para mais fotografias."); return; }
      if (files.length > remaining) {
        toast.error(`Só há espaço para mais ${remaining} imagem${remaining === 1 ? "" : "s"}; as restantes foram ignoradas.`);
        toUpload = files.slice(0, remaining);
      }
    } else {
      toUpload = files.slice(0, 1);
    }

    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of toUpload) {
        const dataUrl = await compressedDataUrl(file);
        const asset = await uploadImage.mutateAsync({ id: article.id, dataUrl, fileName: file.name });
        if (target === "cover") setMetadata((current) => ({ ...current, coverImageUrl: asset.url }));
        else if (target === "social") setMetadata((current) => ({ ...current, socialImageUrl: asset.url }));
        else setImages((current) => [...current, { url: asset.url, storageKey: asset.key, altText: file.name.replace(/\.[^/.]+$/, ""), caption: "", position: current.length }]);
        uploaded += 1;
      }
      if (target === "cover") toast.success("Imagem de capa pronta a guardar.");
      else if (target === "social") toast.success("Imagem de partilha pronta a guardar.");
      else toast.success(uploaded === 1 ? "Imagem adicionada à galeria. Guarde o artigo para persistir a ordem e a legenda." : `${uploaded} imagens adicionadas à galeria. Guarde o artigo para persistir a ordem e a legenda.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar a imagem."); } finally { setUploading(false); }
  }

  async function handleCreateMarca(name: string) {
    try {
      const created = await createCategory.mutateAsync({ name, kind: "marca" });
      if (!created) return null;
      await utils.editorial.categories.invalidate();
      return { id: created.id, name: created.name };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a marca.");
      return null;
    }
  }

  async function handleSectionImageUpload(event: ChangeEvent<HTMLInputElement>, index: number) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !article) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um ficheiro de imagem."); return; }
    setUploading(true);
    try {
      const dataUrl = await compressedDataUrl(file);
      const asset = await uploadImage.mutateAsync({ id: article.id, dataUrl, fileName: file.name });
      updateSection(index, { body: asset.url });
      toast.success("Foto carregada. Guarde o artigo para persistir.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar a imagem."); } finally { setUploading(false); }
  }

  if (isNew || (detailQuery.isLoading && !article)) return <DashboardLayout><div className="mx-auto max-w-6xl py-14 font-mono text-xs uppercase tracking-[0.13em]">A preparar rascunho…</div></DashboardLayout>;
  if (!article) return <DashboardLayout><div className="mx-auto max-w-6xl py-14"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Artigo indisponível</p><Link href="/redacao" className="mt-5 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-xs font-bold uppercase tracking-[0.12em]"><ArrowLeft size={15} /> Voltar à redação</Link></div></DashboardLayout>;

  return <DashboardLayout><div className="mx-auto max-w-6xl pb-12"><div className="flex flex-col gap-5 border-b-2 border-black pb-5 xl:flex-row xl:items-center xl:justify-between"><div><Link href="/redacao" className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 hover:text-black"><ArrowLeft size={14} /> Redação</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Editor de artigo</h1><span className={`border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${articleStatus === "published" ? "border-[#f0372f] text-[#f0372f]" : "border-black text-neutral-600"}`}>{articleStatus === "published" ? "Publicado" : "Rascunho"}</span></div><p className="mt-2 text-xs text-neutral-500">{readLabel}</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => saveAll()} disabled={isSaving || uploading} variant="outline" className="h-10 rounded-none border-black text-[10px] font-bold uppercase tracking-[0.1em]"><Save size={14} /> {isSaving ? "A guardar…" : "Guardar"}</Button>{articleStatus === "draft" && <Button onClick={() => setDeleteDialogOpen(true)} disabled={isSaving || deleteDraft.isPending} variant="outline" className="h-10 rounded-none border-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-[#f0372f] hover:bg-[#f0372f] hover:text-white"><Trash2 size={14} /> Apagar rascunho</Button>}<Button onClick={() => handlePublish(articleStatus !== "published")} disabled={isSaving || publishArticle.isPending} className="h-10 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-black"><Send size={14} /> {articleStatus === "published" ? "Retirar" : "Publicar"}</Button></div></div>

    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-10"><section className="editor-panel"><div className="editor-panel-heading"><span>01</span><h2>Identidade</h2></div><div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="title">Título (destaque e notícias)</Label><Input id="title" value={metadata.title} onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))} className="editor-input text-xl font-bold tracking-[-0.04em]" placeholder="Título da história" /></div><div className="sm:col-span-2"><Label htmlFor="article-title">Título no artigo</Label><Input id="article-title" value={metadata.articleTitle ?? ""} onChange={(event) => setMetadata((current) => ({ ...current, articleTitle: event.target.value }))} className="editor-input text-xl font-bold tracking-[-0.04em]" placeholder="Por omissão, utiliza o título acima" /><p className="mt-2 font-mono text-[10px] leading-relaxed text-neutral-500">Deixe em branco para repetir o título de destaque dentro do artigo.</p></div><div className="sm:col-span-2"><Label htmlFor="deck">Subtítulo</Label><Textarea id="deck" value={metadata.deck ?? ""} onChange={(event) => setMetadata((current) => ({ ...current, deck: event.target.value }))} className="editor-input min-h-24" placeholder="Uma introdução que enquadra a história." /></div><div><Label htmlFor="author">Autoria</Label><Input id="author" value={metadata.authorName} onChange={(event) => setMetadata((current) => ({ ...current, authorName: event.target.value }))} className="editor-input" placeholder="Nome da autoria" /></div><div><Label htmlFor="slug">Endereço</Label><Input id="slug" value={metadata.slug} onChange={(event) => setMetadata((current) => ({ ...current, slug: event.target.value }))} className="editor-input font-mono text-xs" placeholder="slug-do-artigo" /></div></div></section>

      <section className="editor-panel"><div className="editor-panel-heading"><span>02</span><h2>Imagem de abertura</h2></div><div className="grid gap-5 sm:grid-cols-[220px_1fr]"><label className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden border border-dashed border-black bg-neutral-50">{metadata.coverImageUrl ? <img src={metadata.coverImageUrl} alt="Pré-visualização da capa" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-center text-[10px] font-bold uppercase tracking-[0.1em]"><ImageUp size={20} /> Carregar capa</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageUpload(event, "cover")} className="sr-only" />{metadata.coverImageUrl && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold uppercase tracking-[0.1em] text-white opacity-0 transition-opacity group-hover:opacity-100">Substituir</span>}</label><div><Label htmlFor="cover-caption">Legenda da capa</Label><Textarea id="cover-caption" value={metadata.coverImageCaption ?? ""} onChange={(event) => setMetadata((current) => ({ ...current, coverImageCaption: event.target.value }))} className="editor-input min-h-24" placeholder="Contexto ou crédito da fotografia." /><p className="mt-3 font-mono text-[10px] leading-relaxed text-neutral-500">As imagens são otimizadas no navegador antes de serem guardadas. Para a melhor apresentação, prefira imagens horizontais com mais de 1600 px de largura.</p></div></div></section>

      <section className="editor-panel"><div className="editor-panel-heading"><span>03</span><h2>Estrutura de leitura</h2><div className="ml-auto flex gap-2"><Button onClick={() => addSection("paragraph")} variant="outline" className="editor-add"><Plus size={13} /> Texto</Button><Button onClick={() => addSection("chapter")} variant="outline" className="editor-add"><Plus size={13} /> Capítulo</Button><Button onClick={() => addSection("quote")} variant="outline" className="editor-add"><Plus size={13} /> Citação</Button><Button onClick={() => addSection("suggested")} variant="outline" className="editor-add"><Plus size={13} /> Sugestões</Button><Button onClick={() => addSection("image")} variant="outline" className="editor-add"><Plus size={13} /> Foto</Button></div></div><p className="mb-4 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Arraste o ícone à esquerda para ordenar os blocos.</p><div className="space-y-4">{sections.length ? sections.map((section, index) => <div key={`${section.position}-${index}`} draggable onDragStart={() => setDraggedSectionIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedSectionIndex !== null && draggedSectionIndex !== index) reorderSections(draggedSectionIndex, index); setDraggedSectionIndex(null); }} onDragEnd={() => setDraggedSectionIndex(null)} className={`border border-black p-4 transition-opacity ${draggedSectionIndex === index ? "opacity-40" : ""}`}><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><button type="button" className="cursor-grab text-neutral-500 active:cursor-grabbing" aria-label={`Arrastar bloco ${index + 1}`}><GripVertical size={17} /></button><span className="font-mono text-[10px] text-[#f0372f]">{String(index + 1).padStart(2, "0")}</span><div className="relative"><select value={section.type} onChange={(event) => updateSection(index, { type: event.target.value as EditorSection["type"], heading: event.target.value === "chapter" ? section.heading || "Novo capítulo" : null })} className="appearance-none border-b border-black bg-white py-1 pr-6 text-[10px] font-bold uppercase tracking-[0.1em] outline-none"><option value="paragraph">Texto</option><option value="chapter">Capítulo</option><option value="quote">Citação</option><option value="suggested">Sugestões</option><option value="image">Foto</option></select><ChevronDown size={12} className="pointer-events-none absolute right-1 top-1.5" /></div></div><button onClick={() => removeSection(index)} className="text-neutral-500 hover:text-[#f0372f]" aria-label="Eliminar bloco"><Trash2 size={15} /></button></div>{section.type === "chapter" && <Input value={section.heading ?? ""} onChange={(event) => updateSection(index, { heading: event.target.value })} className="editor-input mb-3 font-bold" placeholder="Título do capítulo" />}{section.type === "suggested" ? <SuggestedArticlesPicker section={section} onChange={(body) => updateSection(index, { body })} allArticles={allArticles} excludeId={article.id} /> : section.type === "image" ? <div>{section.body ? <div className="relative mb-3 aspect-[4/3] w-full max-w-xs overflow-hidden border border-black bg-neutral-100"><img src={section.body} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => updateSection(index, { body: "" })} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-white text-black hover:bg-[#f0372f] hover:text-white" aria-label="Remover foto"><X size={15} /></button></div> : <label className="relative mb-3 flex aspect-[4/3] w-full max-w-xs cursor-pointer items-center justify-center border border-dashed border-black bg-neutral-50 text-center text-[10px] font-bold uppercase tracking-[0.1em]"><span className="flex flex-col items-center gap-2"><ImageUp size={20} /> Carregar foto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleSectionImageUpload(event, index)} className="sr-only" /></label>}<Input value={section.heading ?? ""} onChange={(event) => updateSection(index, { heading: event.target.value })} className="editor-input mb-3 text-xs" placeholder="Texto alternativo (acessibilidade)" /><Input value={section.caption ?? ""} onChange={(event) => updateSection(index, { caption: event.target.value })} className="editor-input font-mono text-[10px]" placeholder="Legenda opcional" /></div> : <><Textarea value={section.body ?? ""} onChange={(event) => updateSection(index, { body: event.target.value })} className="editor-input min-h-32" placeholder={section.type === "quote" ? "Uma ideia para destacar…" : "Escreva o texto deste bloco…"} /><Input value={section.caption ?? ""} onChange={(event) => updateSection(index, { caption: event.target.value })} className="editor-input mt-3 font-mono text-[10px]" placeholder={section.type === "quote" ? "Fonte ou nota" : "Nota opcional"} /></>}</div>) : <div className="border border-dashed border-black p-7"><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">Adicione texto, capítulos ou citações para construir o ritmo da leitura.</p></div>}</div></section>

      <section className="editor-panel"><div className="editor-panel-heading"><span>04</span><h2>Galeria do artigo</h2><label className={`ml-auto inline-flex cursor-pointer items-center gap-2 border border-black px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors hover:bg-black hover:text-white ${images.length >= 10 ? "pointer-events-none opacity-40" : ""}`}><Upload size={13} /> {uploading ? "A preparar…" : "Adicionar imagens"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void handleImageUpload(event, "gallery")} className="sr-only" disabled={images.length >= 10 || uploading} /></label></div><p className="mb-5 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">{images.length}/10 imagens de destaque · Arraste para ordenar. Clique na imagem no artigo para abrir em ecrã inteiro. Para galerias maiores, use a <Link href="/redacao/multimedia" className="underline">multimédia</Link>.</p>{images.length ? <div className="grid gap-4 sm:grid-cols-2">{images.map((image, index) => <div key={`${image.url}-${index}`} draggable onDragStart={() => setDraggedImageIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedImageIndex !== null && draggedImageIndex !== index) reorderImages(draggedImageIndex, index); setDraggedImageIndex(null); }} onDragEnd={() => setDraggedImageIndex(null)} className={`border border-black p-3 transition-opacity ${draggedImageIndex === index ? "opacity-40" : ""}`}><div className="relative aspect-[4/3] overflow-hidden bg-neutral-100"><img src={image.url} alt="Pré-visualização" className="h-full w-full object-cover" /><button type="button" className="absolute left-2 top-2 flex h-7 w-7 cursor-grab items-center justify-center bg-white text-black active:cursor-grabbing" aria-label={`Arrastar imagem ${index + 1}`}><GripVertical size={15} /></button><button onClick={() => removeImage(index)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-white text-black hover:bg-[#f0372f] hover:text-white" aria-label="Remover imagem"><X size={15} /></button><span className="absolute bottom-0 left-0 bg-white px-2 py-1 font-mono text-[10px] font-bold">{String(index + 1).padStart(2, "0")}</span></div><Input value={image.altText ?? ""} onChange={(event) => updateImage(index, { altText: event.target.value })} className="editor-input mt-3 text-xs" placeholder="Descrição alternativa" /><Textarea value={image.caption ?? ""} onChange={(event) => updateImage(index, { caption: event.target.value })} className="editor-input mt-3 min-h-20 text-xs" placeholder="Legenda da fotografia" /></div>)}</div> : <div className="border border-dashed border-black p-7"><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">O artigo aceita até dez imagens de destaque, com texto alternativo e legenda individuais.</p></div>}</section>

      <section className="editor-panel"><div className="editor-panel-heading"><span>05</span><h2>SEO e partilha</h2></div><div className="grid gap-5"><div><div className="flex items-center justify-between gap-3"><Label htmlFor="seo-title">Título SEO</Label><span className="font-mono text-[10px] text-neutral-500">{(metadata.seoTitle ?? "").length}/70</span></div><Input id="seo-title" value={metadata.seoTitle ?? ""} onChange={(event) => setMetadata((current) => ({ ...current, seoTitle: event.target.value }))} className="editor-input" placeholder="Por omissão, utiliza o título do artigo" /></div><div><div className="flex items-center justify-between gap-3"><Label htmlFor="seo-description">Descrição SEO</Label><span className="font-mono text-[10px] text-neutral-500">{(metadata.seoDescription ?? "").length}/200</span></div><Textarea id="seo-description" value={metadata.seoDescription ?? ""} onChange={(event) => setMetadata((current) => ({ ...current, seoDescription: event.target.value }))} className="editor-input min-h-24" placeholder="Resumo apresentado nos resultados de pesquisa e nos cartões sociais." /></div><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><Label htmlFor="social-image">Imagem de partilha</Label><Input id="social-image" value={metadata.socialImageUrl ?? ""} onChange={(event) => setMetadata((current) => ({ ...current, socialImageUrl: event.target.value }))} className="editor-input" placeholder="Por omissão, utiliza a imagem de capa" /></div><label className="inline-flex cursor-pointer items-center gap-2 self-end border border-black px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors hover:bg-black hover:text-white"><ImageUp size={13} /> Carregar imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageUpload(event, "social")} className="sr-only" /></label></div><div className="border border-black bg-[#f2f2ef] p-3"><p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Pré-visualização de partilha</p><div className="max-w-md overflow-hidden border border-black bg-white">{socialPreviewImage ? <img src={socialPreviewImage} alt="Pré-visualização social" className="aspect-[1.91/1] w-full object-cover" /> : <div className="aspect-[1.91/1] bg-neutral-200" />}<div className="p-4"><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">MOTOR DE LINHA</p><p className="text-lg font-black leading-[0.98] tracking-[-0.04em]">{socialPreviewTitle}</p><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-600">{socialPreviewDescription}</p></div></div></div></div></section></div>

      <aside className="space-y-6 xl:sticky xl:top-4 xl:self-start"><section className="border border-black p-5"><TagMultiSelect label="Tipo de carro" options={categories.filter((category) => category.kind === "tipo")} selectedIds={categoryIds.filter((id) => categories.some((category) => category.id === id && category.kind === "tipo"))} onChange={(tipoIds) => setCategoryIds((items) => [...items.filter((id) => !categories.some((category) => category.id === id && category.kind === "tipo")), ...tipoIds])} placeholder="Selecionar tipo…" /></section><section className="border border-black p-5"><TagMultiSelect label="Marca" options={categories.filter((category) => category.kind === "marca")} selectedIds={categoryIds.filter((id) => categories.some((category) => category.id === id && category.kind === "marca"))} onChange={(marcaIds) => setCategoryIds((items) => [...items.filter((id) => !categories.some((category) => category.id === id && category.kind === "marca")), ...marcaIds])} placeholder="Selecionar marca…" onCreate={handleCreateMarca} /></section><section className="border border-black p-5"><label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><Checkbox checked={metadata.isFeatured} onCheckedChange={(checked) => setMetadata((current) => ({ ...current, isFeatured: Boolean(checked) }))} /><span>Mostrar em destaque</span></label><p className="mt-3 text-xs leading-relaxed text-neutral-500">Os artigos destacados são priorizados na página inicial.</p></section><section className="border-2 border-black p-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0372f]">Publicação</p><p className="mt-3 text-sm leading-relaxed text-neutral-600">O artigo fica invisível ao público enquanto estiver em rascunho.</p><Button onClick={() => handlePublish(articleStatus !== "published")} disabled={isSaving || publishArticle.isPending} className="mt-5 h-10 w-full rounded-none bg-black text-[10px] font-bold uppercase tracking-[0.11em] text-white hover:bg-[#f0372f]"><Check size={14} /> {articleStatus === "published" ? "Marcar como rascunho" : "Publicar no site"}</Button></section></aside></div></div><AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleteDraft.isPending) setDeleteDialogOpen(open); }}><AlertDialogContent className="rounded-none border-2 border-black"><AlertDialogHeader><AlertDialogTitle>Apagar este rascunho?</AlertDialogTitle><AlertDialogDescription>“{metadata.title}” e todo o seu conteúdo serão removidos permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteDraft.isPending} className="rounded-none border-black">Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteDraft.isPending} onClick={() => void handleDeleteDraft()} className="rounded-none bg-[#f0372f] text-white hover:bg-black">{deleteDraft.isPending ? "A apagar…" : "Apagar rascunho"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></DashboardLayout>;
}
