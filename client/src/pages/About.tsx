import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { Mail, Send } from "lucide-react";

export default function About() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-8 sm:py-12">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Sobre mim</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.075em] sm:text-7xl">Pedro Félix</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">Espaço reservado — atualize com o texto real sobre quem escreve o Motor de Linha.</p>

        <div className="mt-14 grid gap-10 border-t-2 border-black pt-8 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5 text-base leading-relaxed text-neutral-700">
            <p>Espaço reservado — apresentação pessoal: quem é, o que o liga a automóveis, e porque criou o Motor de Linha. Duas ou três frases bastam para dar contexto a quem chega pela primeira vez.</p>
            <p>Espaço reservado — percurso ou experiência relevante (jornalismo, engenharia, paixão de longa data por carros, etc.), e o que distingue a abordagem editorial desta revista.</p>
            <p>Espaço reservado — o que o leitor pode esperar encontrar aqui: ensaios, testes, cultura automóvel, ou o que fizer mais sentido.</p>
          </div>

          <div className="border border-black p-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Contacto</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-[#f0372f]" />
                <div>
                  <p className="text-sm font-bold">redacao@motordelinha.pt</p>
                  <p className="mt-1 text-xs text-neutral-500">Espaço reservado — atualize com o email real.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Send size={18} className="mt-0.5 shrink-0 text-[#f0372f]" />
                <div>
                  <p className="text-sm font-bold">Redes sociais</p>
                  <p className="mt-1 text-xs text-neutral-500">Espaço reservado — adicione ligações às redes sociais.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
