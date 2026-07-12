import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { useBlocks } from "@/hooks/use-blocks";
import type { TrainingBlock } from "@/lib/pilates";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blocks")({
  component: BlocksPage,
});

function BlocksPage() {
  const { blocks, reload, loading } = useBlocks();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TrainingBlock>>({});

  const openNew = () => {
    const nextOrder = (blocks[blocks.length - 1]?.sort_order ?? 0) + 1;
    setEditing({ sort_order: nextOrder, title: "", description: "", focus: "" });
    setOpen(true);
  };

  const save = async () => {
    if (!editing.title) return toast.error("Título requerido");
    if (editing.id) {
      const { error } = await supabase.from("training_blocks" as any).update({
        sort_order: editing.sort_order,
        title: editing.title,
        description: editing.description,
        focus: editing.focus,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("training_blocks" as any).insert({
        sort_order: editing.sort_order ?? blocks.length + 1,
        title: editing.title,
        description: editing.description,
        focus: editing.focus,
      });
      if (error) return toast.error(error.message);
    }
    setOpen(false);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar bloque? Las clases y objetivos que lo usaban quedarán sin bloque asignado.")) return;
    const { error } = await supabase.from("training_blocks" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  const move = async (b: TrainingBlock, dir: -1 | 1) => {
    const idx = blocks.findIndex((x) => x.id === b.id);
    const other = blocks[idx + dir];
    if (!other) return;
    await supabase.from("training_blocks" as any).update({ sort_order: other.sort_order }).eq("id", b.id);
    await supabase.from("training_blocks" as any).update({ sort_order: b.sort_order }).eq("id", other.id);
    reload();
  };

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        title="Bloques de entrenamiento"
        subtitle="Fases del plan anual. Créalos, ordénalos y edítalos a tu gusto."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew} className="rounded-full"><Plus className="size-4" /> Nuevo bloque</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Nuevo"} bloque</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-[80px_1fr] gap-3">
                  <div className="space-y-2"><Label>Nº</Label><Input type="number" value={editing.sort_order ?? 1} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Título</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ej. Fundamentos y alineación" /></div>
                </div>
                <div className="space-y-2"><Label>Foco / meses</Label><Input value={editing.focus ?? ""} onChange={(e) => setEditing({ ...editing, focus: e.target.value })} placeholder="Ej. Meses 1–3 · Powerhouse, respiración" /></div>
                <div className="space-y-2"><Label>Descripción</Label><Textarea rows={4} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Qué se trabaja, repertorio, máquinas…" /></div>
              </div>
              <DialogFooter><Button onClick={save} className="rounded-full">Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : blocks.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-muted-foreground">No hay bloques. Crea el primero.</p></Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((b, i) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start gap-4">
                <div className="text-3xl font-display font-semibold text-primary/60 min-w-[2.5rem] text-center">{b.sort_order}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg font-semibold">{b.title}</div>
                  {b.focus && <div className="text-xs text-muted-foreground mt-0.5">{b.focus}</div>}
                  {b.description && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{b.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === 0} onClick={() => move(b, -1)}><ArrowUp className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === blocks.length - 1} onClick={() => move(b, 1)}><ArrowDown className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => remove(b.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
