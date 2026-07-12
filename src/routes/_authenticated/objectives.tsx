import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useBlocks } from "@/hooks/use-blocks";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/objectives")({
  component: ObjectivesPage,
});

type Objective = { id: string; year: number; quarter: number; title: string; description: string | null };

function ObjectivesPage() {
  const { blocks } = useBlocks();
  const [items, setItems] = useState<Objective[]>([]);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const defaultBlock = () => blocks[0]?.sort_order ?? 1;
  const [editing, setEditing] = useState<Partial<Objective>>({ year: now.getFullYear(), quarter: 1, title: "", description: "" });

  const load = async () => {
    const { data } = await supabase.from("quarterly_objectives").select("*").order("year", { ascending: false }).order("quarter");
    setItems((data ?? []) as Objective[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing({ year: now.getFullYear(), quarter: defaultBlock(), title: "", description: "" });
    setOpen(true);
  };

  const save = async () => {
    if (!editing.title) return toast.error("Título requerido");
    const user = (await supabase.auth.getUser()).data.user;
    if (editing.id) {
      const { error } = await supabase.from("quarterly_objectives").update({
        year: editing.year, quarter: editing.quarter, title: editing.title, description: editing.description,
        updated_by: user?.id,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("quarterly_objectives").insert({
        year: editing.year!, quarter: editing.quarter!, title: editing.title!, description: editing.description,
        created_by: user?.id, updated_by: user?.id,
      });
      if (error) return toast.error(error.message);
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar objetivo?")) return;
    await supabase.from("quarterly_objectives").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title="Objetivos por bloque"
        subtitle="Metas concretas asociadas a cada bloque de entrenamiento."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew} className="rounded-full"><Plus className="size-4" /> Nuevo objetivo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nuevo"} objetivo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Año</Label><Input type="number" value={editing.year ?? now.getFullYear()} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })} /></div>
                  <div className="space-y-2">
                    <Label>Bloque</Label>
                    <Select value={String(editing.quarter ?? defaultBlock())} onValueChange={(v) => setEditing({ ...editing, quarter: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {blocks.length === 0 && <SelectItem value="1">Crea bloques primero</SelectItem>}
                        {blocks.map((b) => <SelectItem key={b.id} value={String(b.sort_order)}>Bloque {b.sort_order} · {b.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Título</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ej. Asentar el powerhouse en iniciación" /></div>
                <div className="space-y-2"><Label>Descripción</Label><Textarea rows={5} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Objetivos concretos, repertorio, máquinas principales…" /></div>
              </div>
              <DialogFooter><Button onClick={save} className="rounded-full">Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {blocks.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Primero crea bloques desde la sección <strong>Bloques</strong> del menú.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {blocks.map((block) => {
            const matching = items.filter((o) => o.quarter === block.sort_order);
            return (
              <Card key={block.id} className="p-5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-primary font-semibold">Bloque {block.sort_order}</div>
                    <div className="font-display text-xl font-semibold mt-0.5">{block.title}</div>
                    {block.focus && <div className="text-xs text-muted-foreground mt-0.5">{block.focus}</div>}
                  </div>
                </div>
                {block.description && <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{block.description}</p>}
                <div className="mt-4 space-y-2">
                  {matching.length === 0 && <p className="text-xs text-muted-foreground italic">Sin objetivos definidos.</p>}
                  {matching.map((o) => (
                    <div key={o.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">{o.year}</div>
                          <div className="font-medium">{o.title}</div>
                          {o.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{o.description}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => { setEditing(o); setOpen(true); }}><Pencil className="size-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => remove(o.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
