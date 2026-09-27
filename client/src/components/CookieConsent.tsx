import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getAdConsent, setAdConsent } from "@/lib/consent";

// Gates ad personalization cookies behind an explicit choice (required in
// the EU/EEA once AdSense goes live) — accepting or rejecting just records
// the choice for now; the AdSense script itself will check getAdConsent()
// before loading once it's wired in. Skipped in the backoffice, same as
// PageviewTracker — this is a reader-facing notice, not an editor concern.
export function CookieConsent() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!location.startsWith("/redacao") && getAdConsent() === null);
  }, [location]);

  function choose(value: "accepted" | "rejected") {
    setAdConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-black bg-black text-white">
      <div className="editorial-shell flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-white/70">
          Usamos estatísticas anónimas para perceber quais os artigos mais lidos e, brevemente, publicidade para ajudar a sustentar o site. Podes aceitar ou recusar os cookies de publicidade — a leitura funciona sempre na mesma. Mais detalhes na <Link href="/privacidade" className="underline underline-offset-2 hover:text-white">política de privacidade</Link>.
        </p>
        <div className="flex shrink-0 gap-3">
          <Button onClick={() => choose("rejected")} variant="outline" className="h-9 rounded-none border-white bg-transparent text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black">Recusar</Button>
          <Button onClick={() => choose("accepted")} className="h-9 rounded-none bg-[#f0372f] text-[10px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white hover:text-black">Aceitar</Button>
        </div>
      </div>
    </div>
  );
}
