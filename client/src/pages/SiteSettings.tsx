import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type HomeForm = { homeKicker: string; homeHeadline: string; homeSubtitle: string };
type AboutForm = { aboutTitle: string; aboutIntro: string; aboutBody: string; aboutEmail: string; aboutEmailEnabled: boolean; aboutSocial: string; aboutSocialEnabled: boolean };

export default function SiteSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = trpc.settings.home.useQuery();
  const saveHome = trpc.settings.manage.saveHome.useMutation();
  const saveAbout = trpc.settings.manage.saveAbout.useMutation();

  const [homeForm, setHomeForm] = useState<HomeForm>({ homeKicker: "", homeHeadline: "", homeSubtitle: "" });
  const [aboutForm, setAboutForm] = useState<AboutForm>({ aboutTitle: "", aboutIntro: "", aboutBody: "", aboutEmail: "", aboutEmailEnabled: true, aboutSocial: "", aboutSocialEnabled: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!data || loaded) return;
    setHomeForm({ homeKicker: data.homeKicker, homeHeadline: data.homeHeadline, homeSubtitle: data.homeSubtitle });
    setAboutForm({ aboutTitle: data.aboutTitle, aboutIntro: data.aboutIntro, aboutBody: data.aboutBody, aboutEmail: data.aboutEmail, aboutEmailEnabled: data.aboutEmailEnabled, aboutSocial: data.aboutSocial, aboutSocialEnabled: data.aboutSocialEnabled });
    setLoaded(true);
  }, [data, loaded]);

  async function handleSaveHome() {
    try {
      await saveHome.mutateAsync({
        homeKicker: homeForm.homeKicker.trim() || null,
        homeHeadline: homeForm.homeHeadline.trim() || null,
        homeSubtitle: homeForm.homeSubtitle.trim() || null,
      });
      toast.success("Página inicial atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar as alterações.");
    }
  }

  async function handleSaveAbout() {
    try {
      await saveAbout.mutateAsync({
        aboutTitle: aboutForm.aboutTitle.trim() || null,
        aboutIntro: aboutForm.aboutIntro.trim() || null,
        aboutBody: aboutForm.aboutBody.trim() || null,
        aboutEmail: aboutForm.aboutEmail.trim() || null,
        aboutEmailEnabled: aboutForm.aboutEmailEnabled,
        aboutSocial: aboutForm.aboutSocial.trim() || null,
        aboutSocialEnabled: aboutForm.aboutSocialEnabled,
      });
      toast.success("Página Sobre atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar as alterações.");
    }
  }

  if (!isAdmin) {
    return <DashboardLayout><div className="mx-auto max-w-6xl py-14"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Acesso restrito</p><p className="mt-4 text-sm leading-relaxed text-neutral-600">Apenas administradores podem editar estas páginas.</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-14 pb-12">
        <div>
          <div className="border-b-2 border-black pb-5">
            <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Página inicial</h1>
            <p className="mt-2 text-xs text-neutral-500">O cabeçalho mostrado no topo do site, antes dos destaques.</p>
          </div>

          {isLoading ? (
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.13em]">A carregar…</p>
          ) : (
            <div className="mt-8 space-y-5">
              <div>
                <Label htmlFor="home-kicker">Etiqueta</Label>
                <Input id="home-kicker" value={homeForm.homeKicker} onChange={(event) => setHomeForm((current) => ({ ...current, homeKicker: event.target.value }))} className="editor-input" placeholder="Revista independente / N.º 01" />
              </div>
              <div>
                <Label htmlFor="home-headline">Título</Label>
                <Textarea id="home-headline" value={homeForm.homeHeadline} onChange={(event) => setHomeForm((current) => ({ ...current, homeHeadline: event.target.value }))} className="editor-input min-h-24 text-xl font-bold tracking-[-0.04em]" placeholder="Automóveis para ler, não apenas medir." />
              </div>
              <div>
                <Label htmlFor="home-subtitle">Subtítulo</Label>
                <Textarea id="home-subtitle" value={homeForm.homeSubtitle} onChange={(event) => setHomeForm((current) => ({ ...current, homeSubtitle: event.target.value }))} className="editor-input min-h-24" placeholder="Ensaios, cultura e design automóvel com tempo para a imagem, a forma e a ideia." />
              </div>
              <Button onClick={() => void handleSaveHome()} disabled={saveHome.isPending} className="h-10 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-black"><Save size={14} /> {saveHome.isPending ? "A guardar…" : "Guardar"}</Button>
            </div>
          )}
        </div>

        <div>
          <div className="border-b-2 border-black pb-5">
            <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Sobre</h1>
            <p className="mt-2 text-xs text-neutral-500">O conteúdo da página pública /sobre.</p>
          </div>

          {isLoading ? (
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.13em]">A carregar…</p>
          ) : (
            <div className="mt-8 space-y-5">
              <div>
                <Label htmlFor="about-title">Nome / título</Label>
                <Input id="about-title" value={aboutForm.aboutTitle} onChange={(event) => setAboutForm((current) => ({ ...current, aboutTitle: event.target.value }))} className="editor-input" placeholder="Pedro Félix" />
              </div>
              <div>
                <Label htmlFor="about-intro">Introdução</Label>
                <Textarea id="about-intro" value={aboutForm.aboutIntro} onChange={(event) => setAboutForm((current) => ({ ...current, aboutIntro: event.target.value }))} className="editor-input min-h-20" placeholder="Uma ou duas frases de abertura." />
              </div>
              <div>
                <Label htmlFor="about-body">Texto principal</Label>
                <Textarea id="about-body" value={aboutForm.aboutBody} onChange={(event) => setAboutForm((current) => ({ ...current, aboutBody: event.target.value }))} className="editor-input min-h-40" placeholder="Separe parágrafos com uma linha em branco." />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="about-email">Email de contacto</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">{aboutForm.aboutEmailEnabled ? "Visível" : "Oculto"}</span>
                    <Switch id="about-email-enabled" checked={aboutForm.aboutEmailEnabled} onCheckedChange={(checked) => setAboutForm((current) => ({ ...current, aboutEmailEnabled: checked }))} />
                  </div>
                </div>
                <Input id="about-email" value={aboutForm.aboutEmail} onChange={(event) => setAboutForm((current) => ({ ...current, aboutEmail: event.target.value }))} className="editor-input" placeholder="redacao@autoturbo.pt" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="about-social">Redes sociais</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">{aboutForm.aboutSocialEnabled ? "Visível" : "Oculto"}</span>
                    <Switch id="about-social-enabled" checked={aboutForm.aboutSocialEnabled} onCheckedChange={(checked) => setAboutForm((current) => ({ ...current, aboutSocialEnabled: checked }))} />
                  </div>
                </div>
                <Textarea id="about-social" value={aboutForm.aboutSocial} onChange={(event) => setAboutForm((current) => ({ ...current, aboutSocial: event.target.value }))} className="editor-input min-h-20" placeholder="Ligações às redes sociais." />
              </div>
              <Button onClick={() => void handleSaveAbout()} disabled={saveAbout.isPending} className="h-10 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-black"><Save size={14} /> {saveAbout.isPending ? "A guardar…" : "Guardar"}</Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
