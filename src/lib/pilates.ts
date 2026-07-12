export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export const LEVELS = ["iniciacion", "intermedio", "avanzado"] as const;

export function levelLabel(l: string) {
  return l === "iniciacion" ? "Iniciación" : l === "intermedio" ? "Intermedio" : l === "avanzado" ? "Avanzado" : l;
}

export function currentQuarter(date = new Date()) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0=Mon
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function formatDateEs(d: Date) {
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export type TrainingBlock = {
  id: string;
  sort_order: number;
  title: string;
  description: string | null;
  focus: string | null;
};
