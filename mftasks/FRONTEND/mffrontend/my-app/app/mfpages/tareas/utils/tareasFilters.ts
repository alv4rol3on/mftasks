import { Task } from "@/lib/types";

export type EstadoFiltro =
  | "TODOS"
  | "EN_PROCESO"
  | "APROBADO"
  | "EN_DESARROLLO"
  | "STAND_BY"
  | "SOLUCIONADO"
  | "RECHAZADO"
  | "FUERA_DE_TIEMPO";

export type CampoFecha = "solicitud" | "entrega";

export interface FiltrosTareas {
  busqueda?: string;
  estado?: EstadoFiltro;
  campoFecha?: CampoFecha;
  desde?: string; // yyyy-mm-dd (día en America/Lima)
  hasta?: string; // yyyy-mm-dd (día en America/Lima)
}

export const ESTADOS_TAREA: { value: EstadoFiltro; label: string }[] = [
  { value: "TODOS", label: "Todos los estados" },
  { value: "EN_PROCESO", label: "EN PROCESO" },
  { value: "APROBADO", label: "APROBADO" },
  { value: "EN_DESARROLLO", label: "EN DESARROLLO" },
  { value: "STAND_BY", label: "STAND BY" },
  { value: "FUERA_DE_TIEMPO", label: "FUERA DE TIEMPO" },
  { value: "SOLUCIONADO", label: "SOLUCIONADO" },
  { value: "RECHAZADO", label: "RECHAZADO" },
];

const formatDiaLima = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día calendario (YYYY-MM-DD) en zona America/Lima para comparar rangos. */
export function diaLima(fecha: string | null | undefined): string | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return formatDiaLima.format(d);
}

function coincideEstado(t: Task, estado: EstadoFiltro): boolean {
  if (estado === "TODOS") return true;
  if (estado === "EN_PROCESO") {
    return t.estado === "APROBADO" || t.estado === "EN_DESARROLLO" || t.estado === "STAND_BY";
  }
  if (estado === "FUERA_DE_TIEMPO") return t.fuera_de_tiempo === true;
  return t.estado === estado;
}

/**
 * Filtra tareas por búsqueda, estado y rango de fechas (día en America/Lima).
 * - Búsqueda: ticket o asunto.
 * - Estado: individual, EN_PROCESO (APROBADO+EN_DESARROLLO+STAND_BY) o FUERA_DE_TIEMPO.
 * - Fecha: campo solicitud (fecha_creacion) o entrega (fecha_entrega_aproximada).
 * - El auto-ocultado de SOLUCIONADO con +3 días solo aplica sin filtros ni búsqueda.
 */
export function filtrarTareas(tareas: Task[], filtros: FiltrosTareas = {}): Task[] {
  const q = (filtros.busqueda ?? "").trim().toLowerCase();
  const estado = filtros.estado ?? "TODOS";
  const campo = filtros.campoFecha ?? "solicitud";
  const desde = filtros.desde || "";
  const hasta = filtros.hasta || "";
  const hayFiltro = estado !== "TODOS" || !!desde || !!hasta;
  const ahora = new Date();
  const tresDiasAtras = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000);

  return tareas.filter((t) => {
    if (q) {
      const ticket = (t.ticket ?? "").toLowerCase();
      const asunto = (t.asunto ?? "").toLowerCase();
      if (!ticket.includes(q) && !asunto.includes(q)) return false;
    }

    if (!coincideEstado(t, estado)) return false;

    if (desde || hasta) {
      const valor = campo === "entrega" ? t.fecha_entrega_aproximada : t.fecha_creacion;
      const dia = diaLima(valor);
      if (!dia) return false;
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
    }

    if (!q && !hayFiltro && t.estado === "SOLUCIONADO") {
      const fechaSol = t.fecha_solucion
        ? new Date(t.fecha_solucion)
        : t.fecha_creacion
          ? new Date(t.fecha_creacion)
          : null;
      if (fechaSol && fechaSol < tresDiasAtras) return false;
    }

    return true;
  });
}
