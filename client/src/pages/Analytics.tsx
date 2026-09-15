import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-black p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.07em]">{value}</p>
      {note && <p className="mt-2 text-[10px] leading-snug text-neutral-400">{note}</p>}
    </div>
  );
}

function formatSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
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
          <p className="mt-2 text-xs text-neutral-500">Visitas, alcance e engagement no site público. Não conta a tua navegação aqui na redação.</p>
        </div>

        {isLoading || !data ? (
          <p className="font-mono text-xs uppercase tracking-[0.13em]">A carregar…</p>
        ) : (
          <>
            <div>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">Visualizações</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="24h" value={data.last24h.toLocaleString("pt-PT")} />
                <StatTile label="7 dias" value={data.last7d.toLocaleString("pt-PT")} />
                <StatTile label="30 dias" value={data.last30d.toLocaleString("pt-PT")} />
                <StatTile label="Totais" value={data.totalPageviews.toLocaleString("pt-PT")} />
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">Alcance (visitantes únicos)</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="24h" value={data.reach24h.toLocaleString("pt-PT")} />
                <StatTile label="7 dias" value={data.reach7d.toLocaleString("pt-PT")} />
                <StatTile label="30 dias" value={data.reach30d.toLocaleString("pt-PT")} />
                <StatTile label="Totais" value={data.reachTotal.toLocaleString("pt-PT")} />
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]">Engagement (últimos 30 dias)</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatTile label="Tempo médio no artigo" value={formatSeconds(data.avgArticleReadSeconds)} />
                <StatTile label="Taxa de cliques em partilhar" value={formatPercent(data.shareClickRate)} />
                <StatTile label="Artigos por visita" value={data.avgArticlesPerVisit.toFixed(1)} />
                <StatTile
                  label="Taxa de rejeição"
                  value={formatPercent(data.bounceRate)}
                  note="Percentagem de visitas que só viram uma página e saíram, sem ir a mais nenhuma parte do site. Não é necessariamente mau — alguém que lê um artigo inteiro e fecha também conta como rejeição."
                />
                <StatTile label="Cliques totais" value={data.totalClicks.toLocaleString("pt-PT")} />
              </div>
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
