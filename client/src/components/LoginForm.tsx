import { FormEvent, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error ?? "Não foi possível iniciar sessão.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div>
        <Label htmlFor="login-username">Utilizador</Label>
        <Input id="login-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
      </div>
      <div>
        <Label htmlFor="login-password">Palavra-passe</Label>
        <Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={loading} className="w-full shadow-lg hover:shadow-xl transition-all">
        {loading ? "A entrar…" : "Entrar"}
      </Button>
    </form>
  );
}
