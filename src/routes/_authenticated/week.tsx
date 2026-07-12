import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DAYS, startOfWeek, addDays, isoDate, formatDateEs, currentQuarter,
} from "@/lib/pilates";
import { useBlocks } from "@/hooks/use-blocks";
import { ChevronLeft, ChevronRight, Clock, Plus, Users, Trash2, UserPlus, Check, X, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/week")({
  component: WeekPage,
});

type Slot = { id: string; label: string; day_of_week: number; start_time: string; duration_min: number; capacity: number; active: boolean; end_date: string | null };
type Session = { id: string; slot_id: string | null; session_date: string; start_time: string; duration_min: number; capacity: number; focus_block: number | null; warmup: string | null; main_block: string | null; cooldown: string | null; notes: string | null };
type Attendee = { id: string; session_id: string; patient_id: string; status: string };
type Patient = { id: string; full_name: string; frequency_per_week: number; current_block: number };
type Objective = { id: string; year: number; quarter: number; title: string; description: string | null };

const emptySlotDraft = () => ({
  label: "",
  days: [] as number[],
  start_time: "10:00",
  duration_min: 50,
  capacity: 4,
  end_date: "",
});

function WeekPage() {
  const { blocks, byOrder } = useBlocks();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotDraft, setSlotDraft] = useState(emptySlotDraft());
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
    setSlots((s.data ?? []) as unknown as Slot[]);
    setSessions((sess.data ?? []) as Session[]);
    setAttendees((att.data ?? []) as Attendee[]);
    setPatients((pats.data ?? []) as Patient[]);
    setObjective((objs.data ?? null) as Objective | null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStart.getTime()]);

  const saveSlot = async () => {
    if (!slotDraft.label) return toast.error("Etiqueta requerida");
    if (slotDraft.days.length === 0) return toast.error("Elige al menos un día");
    const user = (await supabase.auth.getUser()).data.user;
    const rows = slotDraft.days.map((d) => ({
      label: slotDraft.label,
      day_of_week: d,
      start_time: slotDraft.start_time,
      duration_min: slotDraft.duration_min,
      capacity: slotDraft.capacity,
      active: true,
      end_date: slotDraft.end_date || null,
      created_by: user?.id,
      updated_by: user?.id,
    }));
    const { error } = await supabase.from("session_slots").insert(rows as any);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} slot(s) creados`);
    setSlotOpen(false);
    setSlotDraft(emptySlotDraft());
    load();
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("¿Eliminar slot recurrente?")) return;
    await supabase.from("session_slots").delete().eq("id", id);
    load();
  };

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
      focus_block: blocks[0]?.sort_order ?? null,
      created_by: user?.id,
      updated_by: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return null; }
    setSessions((prev) => [...prev, data as Session]);
    return data as Session;
  };

  const attFor = (sessionId: string) => attendees.filter((a) => a.session_id === sessionId);

  const toggleDay = (d: number) => {
    setSlotDraft((s) => ({
      ...s,
      days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort(),
    }));
  };

  return (
    <div className="p-8 max-w-[1400px]">
      <PageHeader
        title="Planificación semanal"
        subtitle={`Semana del ${weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" className="rounded-full" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="size-4" /></Button>
            <Dialog open={slotOpen} onOpenChange={(o) => { setSlotOpen(o); if (!o) setSlotDraft(emptySlotDraft()); }}>
              <DialogTrigger asChild><Button className="rounded-full"><Plus className="size-4" /> Nueva clase</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva clase recurrente</DialogTitle>
                  <p className="text-sm text-muted-foreground pt-1">Se creará un slot por cada día seleccionado. Aparecerán en el calendario todas las semanas.</p>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Etiqueta</Label><Input value={slotDraft.label} onChange={(e) => setSlotDraft({ ...slotDraft, label: e.target.value })} placeholder="Reformer grupo A" /></div>
                  <div className="space-y-2">
                    <Label>Se repite estos días</Label>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS.map((d, i) => {
                        const on = slotDraft.days.includes(i);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDay(i)}
                            className={`py-2 rounded-lg text-xs font-medium border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"}`}
                          >
                            {d.slice(0, 1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Hora</Label><Input type="time" value={slotDraft.start_time} onChange={(e) => setSlotDraft({ ...slotDraft, start_time: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Hasta (opcional)</Label><Input type="date" value={slotDraft.end_date} onChange={(e) => setSlotDraft({ ...slotDraft, end_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Duración (min)</Label><Input type="number" value={slotDraft.duration_min} onChange={(e) => setSlotDraft({ ...slotDraft, duration_min: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Aforo</Label><Input type="number" value={slotDraft.capacity} onChange={(e) => setSlotDraft({ ...slotDraft, capacity: Number(e.target.value) })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={saveSlot} className="rounded-full">Crear</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {objective && (
        <Card className="p-5 mb-6 bg-primary/5 border-primary/20">
          <div className="text-xs uppercase tracking-wide text-primary font-semibold">Objetivo del trimestre</div>
          <div className="font-display text-xl font-semibold mt-1">{objective.title}</div>
          {objective.description && <p className="text-sm text-muted-foreground mt-1">{objective.description}</p>}
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : slots.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Aún no hay clases. Crea la primera con el botón "Nueva clase".</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = addDays(weekStart, i);
            const dayIso = isoDate(day);
            const daySlots = slots
              .filter((s) => s.day_of_week === i && s.active && (!s.end_date || s.end_date >= dayIso))
              .sort((a, b) => a.start_time.localeCompare(b.start_time));
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
          blocks={blocks}
          byOrder={byOrder}
          onClose={() => setOpenSession(null)}
          reload={load}
        />
      )}
    </div>
  );
}

function SessionDialog({ session, attendees, patients, blocks, byOrder, onClose, reload }: {
  session: Session; attendees: Attendee[]; patients: Patient[];
  blocks: ReturnType<typeof useBlocks>["blocks"];
  byOrder: ReturnType<typeof useBlocks>["byOrder"];
  onClose: () => void; reload: () => void;
}) {
  const [draft, setDraft] = useState<Session>(session);
  useEffect(() => setDraft(session), [session.id]);
  const [addOpen, setAddOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupDates, setDupDates] = useState<string[]>([isoDate(addDays(new Date(session.session_date + "T00:00:00"), 7))]);
  const [dupIncludeAttendees, setDupIncludeAttendees] = useState(false);

  const present = new Set(attendees.map((a) => a.patient_id));
  const available = patients.filter((p) => !present.has(p.id));
  const focus = byOrder(draft.focus_block);

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

  const duplicate = async () => {
    const dates = dupDates.filter(Boolean);
    if (dates.length === 0) return toast.error("Añade al menos una fecha");
    const user = (await supabase.auth.getUser()).data.user;
    const rows = dates.map((d) => ({
      slot_id: session.slot_id,
      session_date: d,
      start_time: session.start_time,
      duration_min: session.duration_min,
      capacity: session.capacity,
      focus_block: session.focus_block,
      warmup: session.warmup,
      main_block: session.main_block,
      cooldown: session.cooldown,
      notes: session.notes,
      created_by: user?.id,
      updated_by: user?.id,
    }));
    const { data, error } = await supabase.from("sessions").insert(rows).select();
    if (error) return toast.error(error.message);
    if (dupIncludeAttendees && data && attendees.length > 0) {
      const attRows = (data as Session[]).flatMap((newSess) =>
        attendees.map((a) => ({
          session_id: newSess.id,
          patient_id: a.patient_id,
          status: "programada",
          created_by: user?.id,
          updated_by: user?.id,
        }))
      );
      await supabase.from("session_attendees").insert(attRows);
    }
    toast.success(`Clase duplicada en ${dates.length} fecha(s)`);
    setDupOpen(false);
    setDupDates([""]);
    reload();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="font-display text-2xl">
                Sesión · {formatDateEs(new Date(session.session_date + "T00:00:00"))}
              </DialogTitle>
              <div className="text-sm text-muted-foreground">{session.start_time.slice(0, 5)} · {session.duration_min} min</div>
            </div>
            <Popover open={dupOpen} onOpenChange={setDupOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-full"><Copy className="size-3.5" /> Duplicar</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3" align="end">
                <div className="text-sm font-medium">Duplicar esta clase en:</div>
                {dupDates.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input type="date" value={d} onChange={(e) => {
                      const next = [...dupDates]; next[i] = e.target.value; setDupDates(next);
                    }} />
                    {dupDates.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => setDupDates(dupDates.filter((_, idx) => idx !== i))}><X className="size-4" /></Button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="w-full" onClick={() => setDupDates([...dupDates, ""])}><Plus className="size-3.5" /> Otra fecha</Button>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={dupIncludeAttendees} onCheckedChange={(v) => setDupIncludeAttendees(Boolean(v))} />
                  Copiar también los asistentes ({attendees.length})
                </label>
                <Button className="w-full rounded-full" onClick={duplicate}>Duplicar</Button>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bloque</Label>
              <Select value={draft.focus_block == null ? "" : String(draft.focus_block)} onValueChange={(v) => setDraft({ ...draft, focus_block: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Sin bloque" /></SelectTrigger>
                <SelectContent>
                  {blocks.length === 0 && <SelectItem value="0" disabled>Crea bloques primero</SelectItem>}
                  {blocks.map((b) => <SelectItem key={b.id} value={String(b.sort_order)}>Bloque {b.sort_order} · {b.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {focus?.focus && <p className="text-xs text-muted-foreground">{focus.focus}</p>}
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
