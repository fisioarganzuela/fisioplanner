import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { BLOCKS, LEVELS, levelLabel } from "@/lib/pilates";
import { Plus, Phone, Mail, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients")({
  ssr: false,
  component: PatientsPage,
});

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  frequency_per_week: number;
  notes: string | null;
  current_block: number;
  level: string;
  active: boolean;
};

function emptyPatient(): Patient {
  return { id: "", full_name: "", phone: "", email: "", frequency_per_week: 1, notes: "", current_block: 1, level: "iniciacion", active: true };
}

function PatientsPage() {
  const [items, setItems] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient>(emptyPatient());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("full_name");
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Patient[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter((p) => p.full_name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.includes(q));
  }, [items, search]);

  const onSave = async () => {
    if (!editing.full_name.trim()) return toast.error("El nombre es obligatorio");
    const { id, ...payload } = editing;
    const user = (await supabase.auth.getUser()).data.user;
    if (id) {
      const { error } = await supabase.from("patients").update({ ...payload, updated_by: user?.id }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Paciente actualizado");
    } else {
      const { error } = await supabase.from("patients").insert({ ...payload, created_by: user?.id, updated_by: user?.id });
      if (error) return toast.error(error.message);
      toast.success("Paciente creado");
    }
    setOpen(false);
    setEditing(emptyPatient());
    load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar paciente?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader
        title="Pacientes"
        subtitle="Datos de contacto, frecuencia semanal y bloque actual."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(emptyPatient()); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full"><Plus className="size-4" /> Nuevo paciente</Button>
            </DialogTrigger>
            <PatientDialog editing={editing} setEditing={setEditing} onSave={onSave} />
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, email o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Sin pacientes todavía. Crea el primero.</p>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-lg">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{levelLabel(p.level)} · Bloque {p.current_block}</div>
                </div>
                <Badge className="bg-primary/10 text-primary border-transparent hover:bg-primary/15">{p.frequency_per_week}×/sem</Badge>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {p.phone && <div className="flex items-center gap-2"><Phone className="size-3.5" /> {p.phone}</div>}
                {p.email && <div className="flex items-center gap-2"><Mail className="size-3.5" /> {p.email}</div>}
              </div>
              {p.notes && (
                <p className="mt-3 text-sm bg-muted/60 rounded-lg p-3 line-clamp-3">{p.notes}</p>
              )}
              <div className="mt-4 flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                  <Pencil className="size-3.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientDialog({ editing, setEditing, onSave }: { editing: Patient; setEditing: (p: Patient) => void; onSave: () => void }) {
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing.id ? "Editar paciente" : "Nuevo paciente"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre completo</Label>
          <Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <Select value={String(editing.frequency_per_week)} onValueChange={(v) => setEditing({ ...editing, frequency_per_week: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1×/semana</SelectItem>
                <SelectItem value="2">2×/semana</SelectItem>
                <SelectItem value="3">3×/semana</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bloque</Label>
            <Select value={String(editing.current_block)} onValueChange={(v) => setEditing({ ...editing, current_block: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((b) => (
                  <SelectItem key={b} value={String(b)}>Bloque {b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select value={editing.level} onValueChange={(v) => setEditing({ ...editing, level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{levelLabel(l)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          {BLOCKS[editing.current_block]?.title} · {BLOCKS[editing.current_block]?.months}
        </p>
        <div className="space-y-2">
          <Label>Notas clínicas / lesiones / contraindicaciones</Label>
          <Textarea rows={4} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSave} className="rounded-full">Guardar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
