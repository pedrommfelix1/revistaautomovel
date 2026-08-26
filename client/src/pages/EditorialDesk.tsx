import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, FilePenLine, Plus, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatEdited(value: Date | string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function EditorialDesk() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: articles = [], isLoading } = trpc.editorial.manage.list.useQuery(undefined, { enabled: Boolean(user) });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const newDraftTitle = () => `Rascunho ${Date.now()}`;
  const createArticle = trpc.editorial.manage.create.useMutation({
    onSuccess: (article) => { if (article) setLocation(`/redacao/${article.id}`); },
  });
  const deleteDraft = trpc.editorial.manage.deleteDraft.useMutation({
    onSuccess: async () => { setDeleteTarget(null); await utils.editorial.manage.list.invalidate(); },
    onError: (error) => { setDeleteTarget(null); toast.error(error.message); },
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-12">
        <div className="flex flex-col gap-6 border-b-2 border-black pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Área de publicação</p>
            <h1 className="text-4xl font-black tracking-[-0.07em] sm:text-5xl">Redação</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">Crie e mantenha artigos, capítulos, imagens, legendas e estados de publicação numa só área.</p>
          </div>
          <Button onClick={() => createArticle.mutate({ title: newDraftTitle() })} disabled={createArticle.isPending} className="h-11 rounded-none bg-[#f0372f] px-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-black"><Plus size={16} /> {createArticle.isPending ? "A criar…" : "Novo artigo"}</Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="border border-black p-4"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Total</p><p className="mt-3 text-3xl font-black tracking-[-0.07em]">{articles.length}</p></div>
          <div className="border border-black p-4"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Publicados</p><p className="mt-3 text-3xl font-black tracking-[-0.07em]">{articles.filter((article) => article.status === "published").length}</p></div>
          <div className="border border-black p-4"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Rascunhos</p><p className="mt-3 text-3xl font-black tracking-[-0.07em]">{articles.filter((article) => article.status === "draft").length}</p></div>
        </div>

        <section className="mt-11">
          <div className="mb-4 flex items-center justify-between border-b border-black pb-3"><h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">Histórias</h2><Settings2 size={15} /></div>
          {isLoading ? <p className="py-12 font-mono text-xs uppercase tracking-[0.13em]">A carregar artigos…</p> : articles.length ? <div className="divide-y divide-black border-y-2 border-black">{articles.map((article, index) => <div key={article.id} className="grid gap-3 py-5 sm:grid-cols-[55px_1fr_auto_auto] sm:items-center sm:gap-6"><span className="font-mono text-[11px] text-[#f0372f]">{String(index + 1).padStart(2, "0")}</span><button onClick={() => setLocation(`/redacao/${article.id}`)} className="group min-w-0 text-left"><span className="block break-words text-xl font-black tracking-[-0.055em] group-hover:underline">{article.title}</span><span className="mt-1 block text-xs text-neutral-500">{article.authorName} · atualizado a {formatEdited(article.updatedAt)}</span></button><span className={`w-fit border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${article.status === "published" ? "border-[#f0372f] text-[#f0372f]" : "border-black text-neutral-600"}`}>{article.status === "published" ? "Publicado" : "Rascunho"}</span><div className="flex items-center justify-end gap-3"><ArrowUpRight className="hidden transition-transform group-hover:translate-x-1 sm:block" size={18} /><button type="button" disabled={article.status !== "draft" || deleteDraft.isPending} onClick={() => setDeleteTarget({ id: article.id, title: article.title })} className="flex h-8 w-8 items-center justify-center border border-transparent text-neutral-500 transition-colors hover:border-[#f0372f] hover:text-[#f0372f] disabled:cursor-not-allowed disabled:opacity-20" aria-label={`Apagar rascunho ${article.title}`}><Trash2 size={15} /></button></div></div>)}</div> : <div className="border-y-2 border-black py-12"><FilePenLine size={24} className="mb-4 text-[#f0372f]" /><p className="text-xl font-black tracking-[-0.055em]">A primeira história ainda está por escrever.</p><Button onClick={() => createArticle.mutate({ title: newDraftTitle() })} variant="outline" className="mt-5 rounded-none border-black text-[10px] font-bold uppercase tracking-[0.12em]">Criar artigo</Button></div>}
        </section>
      </div>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleteDraft.isPending) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-none border-2 border-black">
          <AlertDialogHeader><AlertDialogTitle>Apagar este rascunho?</AlertDialogTitle><AlertDialogDescription>“{deleteTarget?.title}” será removido permanentemente, incluindo os seus capítulos e imagens. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleteDraft.isPending} className="rounded-none border-black">Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteDraft.isPending} onClick={() => { if (deleteTarget) deleteDraft.mutate({ id: deleteTarget.id }); }} className="rounded-none bg-[#f0372f] text-white hover:bg-black">{deleteDraft.isPending ? "A apagar…" : "Apagar rascunho"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
