import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/week" });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, fullName || email.split("@")[0]);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    if (mode === "signup") toast.success("Cuenta creada. Revisa tu email si está activada la confirmación.");
    else navigate({ to: "/week" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/90 via-primary to-primary/70 text-primary-foreground">
        <div className="bg-white/95 rounded-2xl p-4 self-start max-w-xs">
          <img src={logo} alt="Fisioterapia Arganzuela" className="w-full h-auto" />
        </div>
        <div>
          <p className="font-display text-5xl leading-[1.05] font-semibold max-w-md">
            Planifica cada<br/>sesión. Cuida<br/>cada cuerpo.
          </p>
          <p className="mt-6 max-w-md text-primary-foreground/85 text-lg">
            Organiza las clases de Pilates máquina del centro: bloques trimestrales,
            planificación semanal y trazabilidad entre monitoras.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">« La salud es el silencio del cuerpo »</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 border-border/70 shadow-sm">
          <img src={logo} alt="Fisioterapia Arganzuela" className="h-12 w-auto mb-6 lg:hidden" />
          <h1 className="font-display text-3xl font-semibold">
            {mode === "login" ? "Bienvenida de nuevo" : "Crea tu cuenta"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === "login" ? "Accede para gestionar las clases." : "Una cuenta por monitora."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej. Lucía" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11 text-base rounded-full">
              {busy ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </Card>
      </div>
    </div>
  );
}
