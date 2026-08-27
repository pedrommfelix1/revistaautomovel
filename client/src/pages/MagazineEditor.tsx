import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { renderPdfCoverDataUrl } from "@/lib/pdfCover";
import { FileText, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

type MagazineIssue = { id: number; title: string; coverImageUrl: string | null };

function uploadMagazinePdf(
  file: File,
  meta: { title: string; description: string; coverImageUrl: string | null; coverImageStorageKey: string | null },
  onProgress: (pct: number) => void,
): Promise<MagazineIssue> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ title: meta.title, fileName: file.name });
    if (meta.description) params.set("description", meta.description);
    if (meta.coverImageUrl) params.set("coverImageUrl", meta.coverImageUrl);
    if (meta.coverImageStorageKey) params.set("coverImageStorageKey", meta.coverImageStorageKey);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/magazine/upload?${params.toString()}`);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Resposta inválida do servidor.")); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText)?.error ?? `Falha ao enviar o PDF (${xhr.status})`)); }
        catch { reject(new Error(`Falha ao enviar o PDF (${xhr.status})`)); }
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar o PDF."));
    xhr.send(file);
  });
}

export default function MagazineEditor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const listQuery = trpc.magazine.list.useQuery();
  const uploadCover = trpc.magazine.manage.uploadCover.useMutation();
  const deleteIssue = trpc.magazine.manage.delete.useMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "rendering" | "uploading">("idle");
  const [progress, setProgress] = useState(0);

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Selecione um ficheiro PDF."); return; }

    setPendingFile(file);
    setStage("rendering");
    try {
      const cover = await renderPdfCoverDataUrl(file);
      setCoverPreview(cover);
      if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o PDF.");
      setPendingFile(null);
      setCoverPreview(null);
    } finally {
      setStage("idle");
    }
  }

  async function handlePublish() {
    if (!pendingFile || !coverPreview) { toast.error("Escolha um PDF primeiro."); return; }
    if (!title.trim()) { toast.error("Dê um título a esta edição."); return; }

    try {
      setStage("uploading");
      setProgress(0);
      const coverAsset = await uploadCover.mutateAsync({ dataUrl: coverPreview, fileName: pendingFile.name });

      await uploadMagazinePdf(
        pendingFile,
        { title: title.trim(), description: description.trim(), coverImageUrl: coverAsset.url, coverImageStorageKey: coverAsset.key },
        setProgress,
      );

      await listQuery.refetch();
      toast.success("Edição publicada.");
      setTitle("");
      setDescription("");
      setPendingFile(null);
      setCoverPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar esta edição.");
    } finally {
      setStage("idle");
      setProgress(0);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteIssue.mutateAsync({ id });
      await listQuery.refetch();
      toast.success("Edição removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover esta edição.");
    }
  }

  if (!isAdmin) {
    return <DashboardLayout><div className="mx-auto max-w-6xl py-14"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Acesso restrito</p><p className="mt-4 text-sm leading-relaxed text-neutral-600">Apenas administradores podem gerir a revista.</p></div></DashboardLayout>;
  }

  const busy = stage !== "idle";
  const issues = listQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-12">
        <div className="border-b-2 border-black pb-5">
          <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Revista</h1>
          <p className="mt-2 text-xs text-neutral-500">Edições em PDF publicadas na tab pública /revista</p>
        </div>

        <div className="mt-6 border border-black p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Nova edição</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            {coverPreview ? (
              <img src={coverPreview} alt="Pré-visualização da capa" className="h-48 w-auto border border-black object-cover" />
            ) : (
              <label className={`flex h-48 w-36 flex-col items-center justify-center gap-2 border border-dashed border-black text-center ${busy ? "pointer-events-none opacity-40" : "cursor-pointer hover:bg-neutral-50"}`}>
                <FileText size={22} />
                <span className="px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-500">{stage === "rendering" ? "A gerar capa…" : "Escolher PDF"}</span>
                <input type="file" accept="application/pdf" onChange={(event) => void handleFileSelect(event)} className="sr-only" disabled={busy} />
              </label>
            )}

            <div className="flex flex-1 flex-col gap-3">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da edição (ex.: N.º 01 — Agosto 2026)" className="editor-input text-sm" disabled={busy} />
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Pequena descrição desta edição" maxLength={300} className="editor-input min-h-20 text-sm" disabled={busy} />
              {pendingFile && <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-500">{pendingFile.name} · {(pendingFile.size / 1024 / 1024).toFixed(1)} MB</p>}
              {stage === "uploading" && (
                <div className="h-2 w-full max-w-xs bg-neutral-200"><div className="h-2 bg-[#f0372f] transition-all" style={{ width: `${progress}%` }} /></div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handlePublish()} disabled={!pendingFile || busy} className="h-10 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-black">
                  <Upload size={13} /> {stage === "uploading" ? `A enviar… ${progress}%` : "Publicar edição"}
                </Button>
                {pendingFile && !busy && (
                  <Button onClick={() => { setPendingFile(null); setCoverPreview(null); }} variant="outline" className="h-10 rounded-none text-[10px] font-bold uppercase tracking-[0.1em]">Cancelar</Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {listQuery.isLoading ? (
            <p className="py-12 font-mono text-xs uppercase tracking-[0.13em]">A carregar edições…</p>
          ) : issues.length ? (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {issues.map((issue) => (
                <div key={issue.id} className="border border-black p-3">
                  <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                    {issue.coverImageUrl ? <img src={issue.coverImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><FileText size={28} className="text-neutral-400" /></div>}
                    <button onClick={() => void handleDelete(issue.id)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-white text-black hover:bg-[#f0372f] hover:text-white" aria-label="Remover edição"><Trash2 size={14} /></button>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-tight">{issue.title}</p>
                  {issue.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{issue.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-black p-7"><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">Ainda não há edições publicadas.</p></div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
