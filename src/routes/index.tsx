import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/week" : "/auth" });
  }, [user, loading, navigate]);
  return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Cargando…</div>;
}
