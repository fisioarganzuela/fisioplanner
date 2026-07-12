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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import {
  DAYS, BLOCKS, startOfWeek, addDays, isoDate, formatDateEs, currentQuarter,
} from "@/lib/pilates";
import { ChevronLeft, ChevronRight, Clock, Plus, Users, Trash2, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/week")({
  ssr: false,
  component: WeekPage,
});

type Slot = { id: string; label: string; day_of_week: number; start_time: string; duration_min: number; capacity: number; active: boolean };
type Session = { id: string; slot_id: string | null; session_date: string; start_time: string; duration_min: number; capacity: number; focus_block: number | null; warmup: string | null; main_block: string | null; cooldown: string | null; notes: string | null };
type Attendee = { id: string; session_id: string; patient_id: string; status: string };
type Patient = { id: string; full_name: string; frequency_per_week: number; current_block: number };
type Objective = { id: string; year: number; quarter: number; title: string; description: string | null };

function WeekPage() {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Partial<Slot>>({ label: "", day_of_week: 0, start_time: "10:00", duration_min: 50, capacity: 4, active: true });
  const [openSession, setOpenSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const weekEnd = addDays(weekStart, 7);

  const load = async () => {
    setLoading(true);
    const [s, sess, att, pats, objs] = await Promise.all([
      supabase.from("session_slots").select("*").order("day_of_week").order("start_time"),
      supabase.from("sessions").select("*").gte("session_date", isoDate(weekStart)).lt("session_date", isoDate(weekEnd)),
      supabase.from("session_attendees").select("*"),
      supabase.from("patients").select("id, full_name, frequency_per_week, current_block").eq("active", true).order("full_name"),
      supabase.from("quarterly_objectives").select("*").eq("year", weekStart.getFullYear()).eq("quarter", currentQuarter(weekStart)).maybeSingle(),
    ]);
    setSlots((s.data ?? []) as Slot[]);
    setSessions((sess.data ?? []) as Session[]);
    setAttendees((att.data ?? []) as Attendee[]);
    setPatients((pats.data ?? []) as Patient[]);
    setObjective((objs.data ?? null) as Objective | null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStart.getTime()]);

  const saveSlot = async () => {
    if (!editingSlot.label) return toast.error("Etiqueta requerida");
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { ...editingSlot, created_by: user?.id, updated_by: user?.id };
    const { error } = await supabase.from("session_slots").insert(payload as any);
    if (error) return toast.error(error.message);
    setSlotOpen(false);
    setEditingSlot({ label: "", day_of_week: 0, start_time: "10:00", duration_min: 50, capacity: 4, active: true });
    load();
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("¿Eliminar slot recurrente?")) return;
    await supabase.from("session_slots").delete().eq("id", id);
    load();
  };

  // sessions indexed by slot + day, or by date/time for ad-hoc
  const sessionFor = (slot: Slot, dayDate: Date) =>
    sessions.find((s) => s.slot_id === slot.id && s.session_date === isoDate(dayDate));

  const ensureSession = async (slot: Slot, dayDate: Date): Promise<Session | null> => {
    const existing = sessionFor(slot, dayDate);
    if (existing) return existing;
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase.from("sessions").insert({
      slot_id: slot.id,
      session_date: isoDate(dayDate),
      start_time: slot.start_time,
      duration_min: slot.duration_min,
      capacity: slot.capacity,
      focus_block: currentBlockForWeek(weekStart),
      created_by: user?.id,
      updated_by: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return null; }
    setSessions((prev) => [...prev, data as Session]);
    return data as Session;
  };

  const attFor = (sessionId: string) => attendees.filter((a) => a.session_id === sessionId);

  return (
    <div className="p-8 max-w-[1400px]">
      <PageHeader
        title="Planificación semanal"
        subtitle={`Semana del ${weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "long" })} — Q${currentQuarter(weekStart)} ${weekStart.getFullYear()}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" className="rounded-full" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="size-4" /></Button>
            <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
              <DialogTrigger asChild><Button className="rounded-full"><Plus className="size-4" /> Slot semanal</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo slot recurrente</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Etiqueta</Label><Input value={editingSlot.label ?? ""} onChange={(e) => setEditingSlot({ ...editingSlot, label: e.target.value })} placeholder="Reformer grupo A" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Día</Label>
                      <Select value={String(editingSlot.day_of_week ?? 0)} onValueChange={(v) => setEditingSlot({ ...editingSlot, day_of_week: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Hora</Label><Input type="time" value={editingSlot.start_time ?? "10:00"} onChange={(e) => setEditingSlot({ ...editingSlot, start_time: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Duración (min)</Label><Input type="number" value={editingSlot.duration_min ?? 50} onChange={(e) => setEditingSlot({ ...editingSlot, duration_min: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Aforo</Label><Input type="number" value={editingSlot.capacity ?? 4} onChange={(e) => setEditingSlot({ ...editingSlot, capacity: Number(e.target.value) })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={saveSlot} className="rounded-full">Crear slot</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {objective && (
        <Card className="p-5 mb-6 bg-primary/5 border-primary/20">
          <div className="text-xs uppercase tracking-wide text-primary font-semibold">Objetivo trimestral · {BLOCKS[currentBlockForWeek(weekStart)]?.title}</div>
          <div className="font-display text-xl font-semibold mt-1">{objective.title}</div>
          {objective.description && <p className="text-sm text-muted-foreground mt-1">{objective.description}</p>}
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : slots.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Aún no hay slots semanales. Crea el primero con el botón “Slot semanal”.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = addDays(weekStart, i);
            const daySlots = slots.filter((s) => s.day_of_week === i && s.active).sort((a, b) => a.start_time.localeCompare(b.start_time));
            return (
              <div key={i} className="min-w-0">
                <div className="mb-2 px-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{DAYS[i]}</div>
                  <div className="font-display font-semibold text-lg">{day.getDate()}</div>
                </div>
                <div className="space-y-2">
                  {daySlots.length === 0 && <div className="text-xs text-muted-foreground/70 px-1 py-3">—</div>}
                  {daySlots.map((slot) => {
                    const sess = sessionFor(slot, day);
                    const att = sess ? attFor(sess.id) : [];
                    return (
                      <button
                        key={slot.id}
                        onClick={async () => {
                          const s = sess ?? await ensureSession(slot, day);
                          if (s) setOpenSession(s);
                        }}
                        className="w-full text-left bg-card border border-border rounded-xl p-3 hover:border-primary/40 hover:shadow-sm transition group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold flex items-center gap-1.5"><Clock className="size-3.5 text-primary" />{slot.start_time.slice(0, 5)}</div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <div className="text-sm mt-1 truncate">{slot.label}</div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          <span className={att.length >= slot.capacity ? "text-destructive font-medium" : ""}>{att.length}/{slot.capacity}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openSession && (
        <SessionDialog
          session={openSession}
          attendees={attFor(openSession.id)}
          patients={patients}
          onClose={() => setOpenSession(null)}
          reload={load}
        />
      )}
    </div>
  );
}

function currentBlockForWeek(d: Date) {
  // Map calendar quarter to training block
  return Math.floor(d.getMonth() / 3) + 1;
}

function SessionDialog({ session, attendees, patients, onClose, reload }: {
  session: Session; attendees: Attendee[]; patients: Patient[]; onClose: () => void; reload: () => void;
}) {
  const [draft, setDraft] = useState<Session>(session);
  useEffect(() => setDraft(session), [session.id]);
  const [addOpen, setAddOpen] = useState(false);

  const present = new Set(attendees.map((a) => a.patient_id));
  const available = patients.filter((p) => !present.has(p.id));

  const save = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("sessions").update({
      warmup: draft.warmup, main_block: draft.main_block, cooldown: draft.cooldown,
      notes: draft.notes, focus_block: draft.focus_block, capacity: draft.capacity,
      updated_by: user?.id,
    }).eq("id", session.id);
    if (error) return toast.error(error.message);
    toast.success("Sesión guardada");
    reload();
  };

  const addPatient = async (patientId: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("session_attendees").insert({
      session_id: session.id, patient_id: patientId, status: "programada",
      created_by: user?.id, updated_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setAddOpen(false);
    reload();
  };

  const removeAttendee = async (id: string) => {
    await supabase.from("session_attendees").delete().eq("id", id);
    reload();
  };

  const setStatus = async (id: string, status: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    await supabase.from("session_attendees").update({ status, updated_by: user?.id }).eq("id", id);
    reload();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Sesión · {formatDateEs(new Date(session.session_date + "T00:00:00"))}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">{session.start_time.slice(0, 5)} · {session.duration_min} min</div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bloque</Label>
              <Select value={String(draft.focus_block ?? 1)} onValueChange={(v) => setDraft({ ...draft, focus_block: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4].map((b) => <SelectItem key={b} value={String(b)}>Bloque {b} · {BLOCKS[b].title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aforo</Label>
              <Input type="number" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">Asistentes ({attendees.length}/{draft.capacity})</h3>
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-full" disabled={attendees.length >= draft.capacity}>
                    <UserPlus className="size-3.5" /> Añadir
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-72" align="end">
                  <Command>
                    <CommandInput placeholder="Buscar paciente..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados</CommandEmpty>
                      <CommandGroup>
                        {available.map((p) => (
                          <CommandItem key={p.id} onSelect={() => addPatient(p.id)}>
                            <span>{p.full_name}</span>
                            <Badge variant="secondary" className="ml-auto">{p.frequency_per_week}×</Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aún no hay pacientes asignados.</p>
            ) : (
              <div className="space-y-1.5">
                {attendees.map((a) => {
                  const p = patients.find((x) => x.id === a.patient_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full" style={{ background: a.status === "asistio" ? "#10B981" : a.status === "falta" ? "#EF4444" : "#94A3B8" }} />
                        <span className="text-sm">{p?.full_name ?? "(paciente borrado)"}</span>
                        {p && <Badge variant="secondary" className="text-[10px]">{p.frequency_per_week}×</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="size-7" title="Asistió" onClick={() => setStatus(a.id, "asistio")}><Check className="size-3.5 text-emerald-600" /></Button>
                        <Button size="icon" variant="ghost" className="size-7" title="Falta" onClick={() => setStatus(a.id, "falta")}><X className="size-3.5 text-destructive" /></Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => removeAttendee(a.id)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2"><Label>Calentamiento (10 min)</Label><Textarea rows={2} value={draft.warmup ?? ""} onChange={(e) => setDraft({ ...draft, warmup: e.target.value })} placeholder="Respiración conectada, articulación de columna, footwork suave…" /></div>
            <div className="space-y-2"><Label>Bloque principal (35 min)</Label><Textarea rows={4} value={draft.main_block ?? ""} onChange={(e) => setDraft({ ...draft, main_block: e.target.value })} placeholder="Series de piernas en poleas, Short Box, Stomach Massage…" /></div>
            <div className="space-y-2"><Label>Vuelta a la calma (5 min)</Label><Textarea rows={2} value={draft.cooldown ?? ""} onChange={(e) => setDraft({ ...draft, cooldown: e.target.value })} placeholder="Mermaid restaurativa, estiramientos…" /></div>
            <div className="space-y-2"><Label>Notas</Label><Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>Cerrar</Button>
          <Button className="rounded-full" onClick={save}>Guardar sesión</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
