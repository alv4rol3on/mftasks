import type { EstadoFiltro } from "@/lib/services/tareasService";

export interface OpcionEstado {
  value: EstadoFiltro;
  label: string;
}

/** Estados que componen el grupo "en proceso" y su selección por defecto. */
export const ESTADOS_EN_PROCESO: EstadoFiltro[] = [
  "EN_ESPERA",
  "APROBADO",
  "EN_DESARROLLO",
  "STAND_BY",
  "FUERA_DE_TIEMPO",
];

export const OPCIONES_ESTADO_TAREA: OpcionEstado[] = [
  { value: "APROBADO", label: "Aprobado" },
  { value: "EN_DESARROLLO", label: "En desarrollo" },
  { value: "STAND_BY", label: "Stand-by" },
  { value: "FUERA_DE_TIEMPO", label: "Fuera de tiempo" },
  { value: "SOLUCIONADO", label: "Solucionado" },
  { value: "RECHAZADO", label: "Rechazado" },
  { value: "CANCELADO", label: "Cancelado" },
];

export const OPCIONES_ESTADO_SOLICITUD: OpcionEstado[] = [
  { value: "EN_ESPERA", label: "En espera" },
  ...OPCIONES_ESTADO_TAREA,
  { value: "REAPERTURA_PENDIENTE", label: "Reapertura pendiente" },
];

/** Estados en proceso disponibles en el catálogo indicado. */
export function estadosEnProceso(opciones: OpcionEstado[]): EstadoFiltro[] {
  const disponibles = new Set(opciones.map((opcion) => opcion.value));
  return ESTADOS_EN_PROCESO.filter((estado) => disponibles.has(estado));
}

/**
 * Filtra valores desconocidos y, si no queda ninguno, devuelve el grupo en
 * proceso disponible para esa vista.
 */
export function normalizarEstados(
  seleccionados: EstadoFiltro[],
  opciones: OpcionEstado[]
): EstadoFiltro[] {
  const disponibles = new Set(opciones.map((opcion) => opcion.value));
  const validos = [...new Set(seleccionados)].filter((estado) =>
    disponibles.has(estado)
  );
  return validos.length > 0 ? validos : estadosEnProceso(opciones);
}

/** Compara dos selecciones sin importar el orden. */
export function estadosIguales(
  a: EstadoFiltro[],
  b: EstadoFiltro[]
): boolean {
  if (a.length !== b.length) return false;
  const conjuntoB = new Set(b);
  return a.every((estado) => conjuntoB.has(estado));
}

export const ESTADOS_TAREA_POR_DEFECTO = estadosEnProceso(
  OPCIONES_ESTADO_TAREA
);

export const ESTADOS_SOLICITUD_POR_DEFECTO = estadosEnProceso(
  OPCIONES_ESTADO_SOLICITUD
);

export const ESTADOS_SOLICITUD_TODOS = OPCIONES_ESTADO_SOLICITUD.map(
  (opcion) => opcion.value
);
