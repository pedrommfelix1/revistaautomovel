import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { Mail, MapPin, Send } from "lucide-react";

export default function Contact() {
  return (
    <div className="min-h-screen bg-white">
      <EditorialHeader />
      <main className="editorial-shell py-8 sm:py-12">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Fale connosco</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.075em] sm:text-7xl">Contactos</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">Sugestões de histórias, parcerias editoriais ou imprensa — estamos disponíveis pelos canais abaixo.</p>

        <div className="mt-14 grid gap-8 border-t-2 border-black pt-8 sm:grid-cols-3">
          <div className="border border-black p-5">
            <Mail size={20} className="text-[#f0372f]" />
            <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Redação</p>
            <p className="mt-2 text-lg font-bold tracking-[-0.03em]">redacao@motordelinha.pt</p>
            <p className="mt-2 text-xs text-neutral-500">Espaço reservado — atualize com o email real.</p>
          </div>
          <div className="border border-black p-5">
            <Send size={20} className="text-[#f0372f]" />
            <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Imprensa e parcerias</p>
            <p className="mt-2 text-lg font-bold tracking-[-0.03em]">parcerias@motordelinha.pt</p>
            <p className="mt-2 text-xs text-neutral-500">Espaço reservado — atualize com o email real.</p>
          </div>
          <div className="border border-black p-5">
            <MapPin size={20} className="text-[#f0372f]" />
            <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Sede</p>
            <p className="mt-2 text-lg font-bold tracking-[-0.03em]">Lisboa, Portugal</p>
            <p className="mt-2 text-xs text-neutral-500">Espaço reservado — atualize com a morada real.</p>
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
