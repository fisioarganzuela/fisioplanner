import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Users, Target, History, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading, profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        Cargando…
      </div>
    );
  }

  return <AppShell profileName={profile?.full_name ?? user.email ?? ""} profileColor={profile?.color ?? "#F97316"} onSignOut={signOut} />;
}

const nav = [
  { to: "/week", label: "Semana", icon: Calendar },
  { to: "/patients", label: "Pacientes", icon: Users },
  { to: "/objectives", label: "Objetivos", icon: Target },
  { to: "/audit", label: "Actividad", icon: History },
] as const;

function AppShell({ profileName, profileColor, onSignOut }: { profileName: string; profileColor: string; onSignOut: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-border">
          <img src={logo} alt="Fisioterapia Arganzuela" className="w-full h-auto" />
          <div className="mt-3 text-xs text-muted-foreground font-medium tracking-wide uppercase">
            Pilates · Gestor
          </div>
        </div>
        <nav className="px-3 mt-2 flex-1 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="size-9 rounded-full grid place-items-center text-white font-semibold text-sm"
              style={{ backgroundColor: profileColor }}
            >
              {profileName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profileName}</div>
              <div className="text-xs text-muted-foreground">Monitora</div>
            </div>
            <Button size="icon" variant="ghost" onClick={onSignOut} title="Salir">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
