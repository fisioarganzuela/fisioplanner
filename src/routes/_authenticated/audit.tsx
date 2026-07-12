import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/audit")({
  ssr: false,
  component: AuditPage,
});

type Row = { id: number; actor_name: string | null; entity_type: string; entity_id: string | null; action: string; created_at: string; changes: any };

const LABELS: Record<string, string> = {
  patients: "Paciente",
  sessions: "Sesión",
  session_slots: "Slot semanal",
  session_attendees: "Asistencia",
  quarterly_objectives: "Objetivo",
  auth: "Sesión de usuaria",
};

const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  insert: { label: "creó", cls: "bg-emerald-100 text-emerald-700" },
  update: { label: "modificó", cls: "bg-amber-100 text-amber-700" },
  delete: { label: "eliminó", cls: "bg-rose-100 text-rose-700" },
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Actividad" subtitle="Quién hizo qué, cuándo y a qué hora. Últimos 300 registros." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-muted-foreground">Aún no hay cambios registrados.</p></Card>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map((r) => {
            const isAuth = r.entity_type === "auth";
            const authEvent: "login" | "logout" | null = isAuth ? (r.changes?.event ?? null) : null;
            const a = isAuth
              ? authEvent === "logout"
                ? { label: "salió de la app", cls: "bg-slate-100 text-slate-700" }
                : { label: "entró en la app", cls: "bg-sky-100 text-sky-700" }
              : ACTION_LABEL[r.action] ?? { label: r.action, cls: "bg-muted" };
            const summary = isAuth ? "" : describe(r);
            return (
              <div key={r.id} className="p-4 flex items-start gap-4">
                <div className="size-9 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold text-sm">
                  {(r.actor_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{r.actor_name ?? "—"}</span>{" "}
                    <Badge className={`${a.cls} border-transparent text-[10px] uppercase tracking-wide`}>{a.label}</Badge>{" "}
                    {!isAuth && <span className="text-muted-foreground">{LABELS[r.entity_type] ?? r.entity_type}</span>}
                  </div>
                  {summary && <div className="text-sm text-muted-foreground mt-1 truncate">{summary}</div>}
                  {r.action === "delete" && !summary && (
                    <div className="text-sm text-muted-foreground mt-1 italic">Registro eliminado</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {fmtDateTime(r.created_at)}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function describe(r: Row): string {
  try {
    const c = r.changes;
    if (!c) return "";
    if (r.action === "update") {
      const before = c.before ?? {};
      const after = c.after ?? {};
      const keys = Object.keys(after).filter((k) => !["updated_at", "updated_by"].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      if (keys.length === 0) return "";
      return "Campos: " + keys.slice(0, 4).join(", ");
    }
    const obj = c.after ?? c;
    return obj.full_name || obj.title || obj.label || obj.session_date || "";
  } catch { return ""; }
}
