import { Task } from "@/lib/types";

/**
 * Filtra tareas según reglas de negocio:
 * - Con búsqueda: por ticket o asunto (ignora fecha)
 * - Sin búsqueda: oculta SOLUCIONADO >3 días, muestra APROBADO/EN_DESARROLLO/STAND_BY sin límite
 */
export function filtrarTareas(tareas: Task[], busqueda: string): Task[] {
  const q = busqueda.trim().toLowerCase();
  const ahora = new Date();
  const tresDiasAtras = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000);

  return tareas.filter((t) => {
    if (q) {
      const ticket = (t.ticket ?? "").toLowerCase();
      const asunto = (t.asunto ?? "").toLowerCase();
      if (!ticket.includes(q) && !asunto.includes(q)) return false;
      return true;
    }
    if (t.estado === "SOLUCIONADO") {
      const fechaSol = t.fecha_solucion ? new Date(t.fecha_solucion) : t.fecha_creacion ? new Date(t.fecha_creacion) : null;
      if (fechaSol && fechaSol < tresDiasAtras) return false;
    }
    return true;
  });
}
