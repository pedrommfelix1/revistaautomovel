import { trpc } from "@/lib/trpc";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function MagazineReader() {
  const [, params] = useRoute("/revista/:id");
  const id = Number(params?.id);
  const { data: issue, isLoading } = trpc.magazine.byId.useQuery({ id }, { enabled: Number.isFinite(id) });

  return (
    <div className="flex h-screen flex-col bg-black">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/20 bg-black px-4 text-white sm:px-6">
        <Link href="/revista" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] no-underline text-white hover:text-[#f0372f]">
          <ArrowLeft size={16} /> Revista
        </Link>
        <p className="max-w-[50%] truncate text-[11px] font-bold uppercase tracking-[0.1em]">{issue?.title ?? ""}</p>
        {issue ? (
          <a href={issue.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] no-underline text-white hover:text-[#f0372f]">
            Abrir noutra aba <ExternalLink size={15} />
          </a>
        ) : <span />}
      </header>

      <div className="flex-1 bg-neutral-800">
        {isLoading ? (
          <div className="flex h-full items-center justify-center"><p className="font-mono text-xs uppercase tracking-[0.13em] text-white/60">A carregar edição…</p></div>
        ) : issue ? (
          <iframe title={issue.title} src={issue.pdfUrl} className="h-full w-full border-0" />
        ) : (
          <div className="flex h-full items-center justify-center"><p className="font-mono text-xs uppercase tracking-[0.13em] text-white/60">Edição não encontrada.</p></div>
        )}
      </div>
    </div>
  );
}
