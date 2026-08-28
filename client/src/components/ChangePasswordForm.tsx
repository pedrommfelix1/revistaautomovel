import { FormEvent, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function ChangePasswordForm({ onSuccess, submitLabel = "Guardar" }: { onSuccess: () => void; submitLabel?: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next !== confirm) { setError("As duas palavras-passe novas não coincidem."); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error ?? "Não foi possível mudar a palavra-passe.");
      setCurrent(""); setNext(""); setConfirm("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível mudar a palavra-passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div>
        <Label htmlFor="pw-current">Palavra-passe atual</Label>
        <Input id="pw-current" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="pw-next">Nova palavra-passe</Label>
        <Input id="pw-next" type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" required minLength={10} />
      </div>
      <div>
        <Label htmlFor="pw-confirm">Confirmar nova palavra-passe</Label>
        <Input id="pw-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required minLength={10} />
      </div>
      <p className="text-xs text-muted-foreground">Pelo menos 10 caracteres, sem ser óbvia (por exemplo, não pode conter o seu nome de utilizador).</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={loading} className="w-full">{loading ? "A guardar…" : submitLabel}</Button>
    </form>
  );
}
