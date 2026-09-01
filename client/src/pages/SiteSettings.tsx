import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type HomeForm = { homeKicker: string; homeHeadline: string; homeSubtitle: string };

export default function SiteSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = trpc.settings.home.useQuery();
  const saveHome = trpc.settings.manage.saveHome.useMutation();

  const [form, setForm] = useState<HomeForm>({ homeKicker: "", homeHeadline: "", homeSubtitle: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!data || loaded) return;
    setForm({ homeKicker: data.homeKicker, homeHeadline: data.homeHeadline, homeSubtitle: data.homeSubtitle });
    setLoaded(true);
  }, [data, loaded]);

  async function handleSave() {
    try {
      await saveHome.mutateAsync({
        homeKicker: form.homeKicker.trim() || null,
        homeHeadline: form.homeHeadline.trim() || null,
        homeSubtitle: form.homeSubtitle.trim() || null,
      });
      toast.success("Página inicial atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar as alterações.");
    }
  }

  if (!isAdmin) {
    return <DashboardLayout><div className="mx-auto max-w-6xl py-14"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f0372f]">Acesso restrito</p><p className="mt-4 text-sm leading-relaxed text-neutral-600">Apenas administradores podem editar a página inicial.</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl pb-12">
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
              <Input id="home-kicker" value={form.homeKicker} onChange={(event) => setForm((current) => ({ ...current, homeKicker: event.target.value }))} className="editor-input" placeholder="Revista independente / N.º 01" />
            </div>
            <div>
              <Label htmlFor="home-headline">Título</Label>
              <Textarea id="home-headline" value={form.homeHeadline} onChange={(event) => setForm((current) => ({ ...current, homeHeadline: event.target.value }))} className="editor-input min-h-24 text-xl font-bold tracking-[-0.04em]" placeholder="Automóveis para ler, não apenas medir." />
            </div>
            <div>
              <Label htmlFor="home-subtitle">Subtítulo</Label>
              <Textarea id="home-subtitle" value={form.homeSubtitle} onChange={(event) => setForm((current) => ({ ...current, homeSubtitle: event.target.value }))} className="editor-input min-h-24" placeholder="Ensaios, cultura e design automóvel com tempo para a imagem, a forma e a ideia." />
            </div>
            <Button onClick={() => void handleSave()} disabled={saveHome.isPending} className="h-10 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-black"><Save size={14} /> {saveHome.isPending ? "A guardar…" : "Guardar"}</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
