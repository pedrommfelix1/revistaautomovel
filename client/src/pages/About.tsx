import { EditorialFooter } from "@/components/EditorialFooter";
import { EditorialHeader } from "@/components/EditorialHeader";
import { trpc } from "@/lib/trpc";
import { Mail, Send } from "lucide-react";

export default function About() {
  const { data } = trpc.settings.about.useQuery();
  const bodyParagraphs = (data?.aboutBody ?? "").split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const showEmail = data?.aboutEmailEnabled && data.aboutEmail;
  const showSocial = data?.aboutSocialEnabled && data.aboutSocial;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EditorialHeader />
      <main className="editorial-shell flex-1 py-8 sm:py-12">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f0372f]"><span className="h-3 w-3 bg-[#f0372f]" /> Sobre mim</p>
        <h1 className="max-w-2xl text-5xl font-black tracking-[-0.075em] sm:text-7xl">Sobre</h1>

        <div className="mt-10 grid gap-10 border-t-2 border-black pt-8 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5 text-base leading-relaxed text-neutral-700">
            {bodyParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>

          {(showEmail || showSocial) && (
            <div className="self-start border border-black p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Contacto</p>
              <div className="mt-4 space-y-4">
                {showEmail && (
                  <div className="flex items-start gap-3">
                    <Mail size={18} className="mt-0.5 shrink-0 text-[#f0372f]" />
                    <p className="text-sm font-bold">{data.aboutEmail}</p>
                  </div>
                )}
                {showSocial && (
                  <div className="flex items-start gap-3">
                    <Send size={18} className="mt-0.5 shrink-0 text-[#f0372f]" />
                    <div>
                      <p className="text-sm font-bold">Redes sociais</p>
                      <p className="mt-1 text-xs text-neutral-500">{data.aboutSocial}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
