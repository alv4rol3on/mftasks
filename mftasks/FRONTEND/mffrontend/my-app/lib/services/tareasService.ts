import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";

interface IniciarPayload {
  fecha_inicio: string;
  fecha_entrega_aproximada: string;
  incluye_sabado: boolean;
  subtareas: { descripcion: string; asignado: number; peso: number }[];
}

export async function fetchTareas(search?: string): Promise<Task[]> {
  const q = search?.trim();
  const url = q ? `/api/tasks/tasks/?search=${encodeURIComponent(q)}` : "/api/tasks/tasks/";
  return apiFetch<Task[]>(url);
}

export async function iniciarTarea(tareaId: number, payload: IniciarPayload): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/iniciar/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function empezarSubtarea(tareaId: number, subtareaId: number): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/empezar/`, {
    method: "POST",
  });
}

export async function completarSubtarea(tareaId: number, subtareaId: number): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/completar/`, {
    method: "POST",
  });
}

export async function cambiarEstadoSubtarea(
  tareaId: number,
  subtareaId: number,
  nuevoEstado: string,
  motivo?: string,
  estadoActual?: string
): Promise<void> {
  if (nuevoEstado === "STAND_BY") {
    if (!motivo) throw new Error("Motivo obligatorio para STAND_BY");
    if (estadoActual !== "EN_ESPERA" && estadoActual !== "EN_DESARROLLO") {
      throw new Error(`No se puede pausar desde ${estadoActual}`);
    }
    await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/standby/`, {
      method: "POST",
      body: JSON.stringify({ motivo }),
    });
    return;
  }
  if (nuevoEstado === "EN_DESARROLLO") {
    if (estadoActual === "EN_ESPERA") {
      await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/empezar/`, { method: "POST" });
      return;
    }
    if (estadoActual === "STAND_BY") {
      await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reanudar/`, { method: "POST" });
      return;
    }
    throw new Error(`Transición no válida ${estadoActual} -> ${nuevoEstado}`);
  }
  if (nuevoEstado === "EN_ESPERA") {
    if (estadoActual === "STAND_BY") {
      await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reanudar/`, { method: "POST" });
      return;
    }
    throw new Error("Esta subtarea fue iniciada, no se puede volver a En espera");
  }
  if (nuevoEstado === "SOLUCIONADO") {
    if (estadoActual === "SOLUCIONADO") throw new Error("Ya está solucionada");
    await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/completar/`, { method: "POST" });
    return;
  }
  throw new Error(`Estado no soportado: ${nuevoEstado}`);
}

export interface LogItem {
  id: number;
  tipo_evento: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  fecha: string;
  detalle: string;
  usuario: string | null;
  subtarea_id: number | null;
  subtarea_descripcion: string | null;
}

export async function fetchLogs(tareaId: number): Promise<LogItem[]> {
  return apiFetch<LogItem[]>(`/api/tasks/tasks/${tareaId}/logs/`);
}

export async function crearDependencia(tareaId: number, bloqueadaId: number, bloqueadoraId: number): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${bloqueadaId}/dependencias/`, {
    method: "POST",
    body: JSON.stringify({ bloqueadora_id: bloqueadoraId }),
  });
}

export async function reasignarSubtarea(tareaId: number, subtareaId: number, nuevoAsignado: number): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reasignar/`, {
    method: "POST",
    body: JSON.stringify({ nuevo_asignado: nuevoAsignado }),
  });
}

export async function inactivarSubtarea(tareaId: number, subtareaId: number): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/inactivar/`, {
    method: "POST",
  });
}

export async function reactivarSubtarea(tareaId: number, subtareaId: number): Promise<void> {
  await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reactivar/`, {
    method: "POST",
  });
}

export async function fetchEquipoMiembros(equipoId: number): Promise<{ id: number; miembros: any[]; lider: any }> {
  return apiFetch(`/api/usuarios/equipos/${equipoId}/`);
}
