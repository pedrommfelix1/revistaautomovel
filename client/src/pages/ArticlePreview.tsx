import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import type { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { ArticleView } from "./Article";

const STATUS_LABEL = { draft: "Rascunho", scheduled: "Agendado", published: "Publicado" } as const;

function PreviewMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Pré-visualização</p>
      <h1 className="max-w-md text-3xl font-black tracking-[-0.05em]">{title}</h1>
      {children}
    </div>
  );
}

export default function ArticlePreview() {
  const [, params] = useRoute("/redacao/:id/preview");
  const { user, loading } = useAuth();
  const articleId = Number(params?.id);
  const valid = Number.isInteger(articleId) && articleId > 0;
  const editorHref = `/redacao/${params?.id ?? ""}`;
  const { data: article, isLoading, isError } = trpc.editorial.manage.detail.useQuery(
    { id: articleId },
    { enabled: Boolean(user) && valid, retry: false },
  );

  if (loading || (Boolean(user) && valid && isLoading)) {
    return <PreviewMessage title="A preparar pré-visualização…" />;
  }
  if (!user) {
    return (
      <PreviewMessage title="Inicie sessão na redação para ver a pré-visualização.">
        <Link href="/redacao" className="border-b-2 border-black pb-1 text-xs font-bold uppercase tracking-[0.12em]">Ir para a redação</Link>
      </PreviewMessage>
    );
  }
  if (!valid || isError || !article) {
    return (
      <PreviewMessage title="Não foi possível abrir este artigo.">
        <Link href="/redacao" className="border-b-2 border-black pb-1 text-xs font-bold uppercase tracking-[0.12em]">Voltar à redação</Link>
      </PreviewMessage>
    );
  }

  const status = article.status === "scheduled" && article.scheduledAt
    ? `Agendado — ${new Date(article.scheduledAt).toLocaleDateString("pt-PT")}`
    : STATUS_LABEL[article.status];

  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-black px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white" data-testid="preview-banner">
        <span><span className="mr-3 bg-[#f0372f] px-2 py-1">Pré-visualização</span>{status} · só visível para a redação</span>
        <Link href={editorHref} className="underline underline-offset-4 hover:text-[#f0372f]">Voltar ao editor</Link>
      </div>
      <ArticleView article={article} preview={{ backHref: editorHref }} />
    </>
  );
}
