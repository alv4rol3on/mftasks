import type { EstadoFiltro } from "@/lib/services/tareasService";

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
