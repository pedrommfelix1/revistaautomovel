import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";

export default function Privacy() {
  const { data } = trpc.settings.about.useQuery();
  const showEmail = data?.aboutEmailEnabled && data.aboutEmail;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-8 sm:py-12">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Legal</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.075em] sm:text-7xl">Política de Privacidade</h1>

        <div className="mt-10 max-w-3xl space-y-8 border-t-2 border-black pt-8 text-base leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-2 text-lg font-black tracking-[-0.03em] text-black">Quem somos</h2>
            <p>O Auto Turbo (autoturbo.pt) publica artigos sobre automóveis. Não é preciso criar conta nem indicar dados pessoais para ler o site.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black tracking-[-0.03em] text-black">Estatísticas de visitas</h2>
            <p>Para perceber quais os artigos mais lidos, guardamos estatísticas anónimas de navegação — páginas vistas, cliques e tempo de leitura — associadas a um identificador aleatório gerado no teu próprio dispositivo (guardado localmente no navegador), nunca ao teu nome, email ou outros dados que te identifiquem.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black tracking-[-0.03em] text-black">Cookies e publicidade</h2>
            <p>O site pode mostrar anúncios através do Google AdSense. Para isso, a Google e os seus parceiros publicitários podem usar cookies ou identificadores semelhantes no teu navegador, para mostrar anúncios relevantes com base na tua atividade.</p>
            <p className="mt-3">Podes gerir ou desativar a publicidade personalizada a qualquer momento em <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#f0372f]">adssettings.google.com</a>, e consultar como a Google usa estes dados em <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#f0372f]">policies.google.com/technologies/partner-sites</a>.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black tracking-[-0.03em] text-black">Partilha de dados</h2>
            <p>Não vendemos dados pessoais. Só partilhamos informação com prestadores de serviço estritamente necessários ao funcionamento do site (alojamento, base de dados, análise de tráfego e, quando ativa, publicidade).</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-black tracking-[-0.03em] text-black">Contacto</h2>
            <p>{showEmail ? <>Para qualquer questão sobre esta política, escreve para <a href={`mailto:${data!.aboutEmail}`} className="underline underline-offset-2 hover:text-[#f0372f]">{data!.aboutEmail}</a>.</> : <>Para qualquer questão sobre esta política, usa os contactos indicados na página Sobre.</>}</p>
          </section>

          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">Última atualização: setembro de 2026.</p>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
