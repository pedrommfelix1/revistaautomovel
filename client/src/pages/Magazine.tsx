import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";
import { FileText } from "lucide-react";
import { Link } from "wouter";

export default function Magazine() {
  const { data: issues = [], isLoading } = trpc.magazine.list.useQuery();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-11 sm:py-16">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Edições completas</p>
        <h1 className="max-w-2xl text-4xl font-black tracking-[-0.07em] sm:text-5xl">Revista</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">As edições completas do Motor de Linha, em PDF, para ler página a página.</p>

        {isLoading ? (
          <p className="mt-12 font-mono text-xs uppercase tracking-[0.13em] text-neutral-500">A carregar edições…</p>
        ) : issues.length ? (
          <div className="mt-12 grid gap-x-7 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {issues.map((issue) => (
              <Link key={issue.id} href={`/revista/${issue.id}`} className="group block no-underline text-black">
                <div className="aspect-[3/4] overflow-hidden bg-[#e9e9e7] transition-transform duration-300 group-hover:scale-[1.02]">
                  {issue.coverImageUrl ? (
                    <img src={issue.coverImageUrl} alt={issue.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><FileText size={32} className="text-neutral-400" /></div>
                  )}
                </div>
                <p className="mt-3 text-base font-bold leading-tight tracking-[-0.02em]">{issue.title}</p>
                {issue.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-600">{issue.description}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-12 border border-dashed border-black p-7"><p className="font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">Ainda não há edições publicadas.</p></div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
