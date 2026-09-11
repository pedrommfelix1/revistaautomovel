import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.07em]">{value.toLocaleString("pt-PT")}</p>
    </div>
  );
}

const CHART_HEIGHT_PX = 160;

function DailyChart({ daily }: { daily: { day: string; count: number }[] }) {
  if (!daily.length) return <p className="text-sm text-neutral-500">Sem dados suficientes ainda.</p>;
  const max = Math.max(...daily.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT_PX }}>
      {daily.map((d) => (
        <div key={d.day} className="group flex-1" title={`${d.day}: ${d.count}`}>
          <div className="bg-[#f0372f] transition-colors group-hover:bg-black" style={{ height: Math.max((d.count / max) * CHART_HEIGHT_PX, 3) }} />
        </div>
      ))}
    </div>
  );
}

function RankedList({ rows, emptyLabel }: { rows: { label: string; count: number }[]; emptyLabel: string }) {
  if (!rows.length) return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-mono text-xs">{row.label}</span>
            <span className="font-bold">{row.count}</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-100">
            <div className="h-1.5 bg-[#f0372f]" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = trpc.analytics.summary.useQuery(undefined, { enabled: isAdmin });

  if (!isAdmin) {
    return <DashboardLayout><div className="mx-auto max-w-6xl py-14"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Acesso restrito</p><p className="mt-4 text-sm leading-relaxed text-neutral-600">Apenas administradores podem ver as métricas.</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-10 pb-12">
        <div className="border-b-2 border-black pb-5">
          <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Métricas</h1>
          <p className="mt-2 text-xs text-neutral-500">Visitas e cliques no site público. Não conta a tua navegação aqui na redação.</p>
        </div>

        {isLoading || !data ? (
          <p className="font-mono text-xs uppercase tracking-[0.13em]">A carregar…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="Visitas 24h" value={data.last24h} />
              <StatTile label="Visitas 7 dias" value={data.last7d} />
              <StatTile label="Visitas 30 dias" value={data.last30d} />
              <StatTile label="Visitas totais" value={data.totalPageviews} />
              <StatTile label="Cliques totais" value={data.totalClicks} />
            </div>

            <div>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">Visitas por dia (últimos 30 dias)</h2>
              <DailyChart daily={data.daily} />
            </div>

            <div className="grid gap-10 sm:grid-cols-2">
              <div>
                <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">Páginas mais vistas (30 dias)</h2>
                <RankedList rows={data.topPages.map((p) => ({ label: p.path, count: p.count }))} emptyLabel="Ainda sem visitas registadas." />
              </div>
              <div>
                <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">Cliques mais frequentes (30 dias)</h2>
                <RankedList rows={data.topClicks.map((c) => ({ label: c.label, count: c.count }))} emptyLabel="Ainda sem cliques registados." />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
