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

type AboutForm = { aboutBody: string; aboutEmail: string; aboutEmailEnabled: boolean; aboutSocial: string; aboutSocialEnabled: boolean };

export default function SiteSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = trpc.settings.about.useQuery();
  const saveAbout = trpc.settings.manage.saveAbout.useMutation();

  const [aboutForm, setAboutForm] = useState<AboutForm>({ aboutBody: "", aboutEmail: "", aboutEmailEnabled: true, aboutSocial: "", aboutSocialEnabled: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!data || loaded) return;
    setAboutForm({ aboutBody: data.aboutBody, aboutEmail: data.aboutEmail, aboutEmailEnabled: data.aboutEmailEnabled, aboutSocial: data.aboutSocial, aboutSocialEnabled: data.aboutSocialEnabled });
    setLoaded(true);
  }, [data, loaded]);

  async function handleSaveAbout() {
    try {
      await saveAbout.mutateAsync({
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
            <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Sobre</h1>
            <p className="mt-2 text-xs text-neutral-500">O conteúdo da página pública /sobre.</p>
          </div>

          {isLoading ? (
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.13em]">A carregar…</p>
          ) : (
            <div className="mt-8 space-y-5">
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
