import { apiFetch } from "@/lib/api";
import type { PrioridadCatalogo, TipoSolicitudCatalogo } from "@/lib/types";

type RespuestaCatalogo<T> = T[] | { results: T[] };

function extraer<T>(data: RespuestaCatalogo<T>): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function fetchTiposSolicitud(): Promise<TipoSolicitudCatalogo[]> {
  const data = await apiFetch<RespuestaCatalogo<TipoSolicitudCatalogo>>(
    "/api/tasks/tipos-solicitud/"
  );
  return extraer(data);
}

export async function fetchPrioridades(): Promise<PrioridadCatalogo[]> {
  const data = await apiFetch<RespuestaCatalogo<PrioridadCatalogo>>(
    "/api/tasks/prioridades/"
  );
  return extraer(data);
}
