"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  cambiarEstadoSubtarea as apiCambiar,
  completarSubtarea as apiCompletar,
  empezarSubtarea as apiEmpezar,
  inactivarSubtarea as apiInactivar,
  iniciarTarea,
  reactivarSubtarea as apiReactivar,
  reanudarSubtarea as apiReanudar,
  reasignarSubtarea as apiReasignar,
  type SubtaskActionResponse,
} from "@/lib/services/tareasService";
import type { Task } from "@/lib/types";

export type IniciarTareaPayload = {
  fecha_inicio: string;
  fecha_entrega_aproximada: string;
  subtareas: { descripcion: string; asignado: number; peso: number }[];
  dependencias: { bloqueada: number; bloqueadora: number }[];
};

type Options = {
  cargar: () => Promise<void>;
  onSolicitudResuelta?: (tareaId: number, res?: SubtaskActionResponse) => void;
};

export function useTareaAcciones({ cargar, onSolicitudResuelta }: Options) {
  const { showToast } = useToast();
  const [accionando, setAccionando] = useState<number | null>(null);
  const [empezandoId, setEmpezandoId] = useState<number | null>(null);
  const [completandoId, setCompletandoId] = useState<number | null>(null);
  const [subtaskEnMovimiento, setSubtaskEnMovimiento] = useState<number | null>(null);

  const iniciar = async (tarea: Task, payload: IniciarTareaPayload) => {
    setAccionando(tarea.id);
    try {
      await iniciarTarea(tarea.id, payload);
      showToast("Tarea iniciada correctamente", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    } finally {
      setAccionando(null);
    }
  };

  const empezarSubtarea = async (tareaId: number, subtareaId: number) => {
    setEmpezandoId(subtareaId);
    setSubtaskEnMovimiento(subtareaId);
    try {
      await apiEmpezar(tareaId, subtareaId);
      showToast("Subtarea iniciada", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    } finally {
      setEmpezandoId(null);
      setSubtaskEnMovimiento(null);
    }
  };

  const completarSubtarea = async (tareaId: number, subtareaId: number) => {
    setCompletandoId(subtareaId);
    setSubtaskEnMovimiento(subtareaId);
    try {
      const res = await apiCompletar(tareaId, subtareaId);
      showToast("Subtarea completada", "success");
      await cargar();
      onSolicitudResuelta?.(tareaId, res);
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    } finally {
      setCompletandoId(null);
      setSubtaskEnMovimiento(null);
    }
  };

  const cambiarEstadoSubtarea = async (
    tareaId: number,
    subtareaId: number,
    nuevoEstado: string,
    motivo?: string,
    estadoActual?: string
  ) => {
    setSubtaskEnMovimiento(subtareaId);
    try {
      if (nuevoEstado === "STAND_BY" && !motivo) {
        throw new Error("Motivo obligatorio para STAND_BY");
      }
      const res = await apiCambiar(tareaId, subtareaId, nuevoEstado, motivo, estadoActual);
      const msgs: Record<string, string> = {
        STAND_BY: "Subtarea en pausa",
        EN_DESARROLLO: estadoActual === "STAND_BY" ? "Subtarea reanudada" : "Subtarea iniciada",
        EN_ESPERA: "Subtarea reanudada a En espera",
        SOLUCIONADO: "Subtarea solucionada",
      };
      showToast(msgs[nuevoEstado] ?? "Estado actualizado", "success");
      await cargar();
      onSolicitudResuelta?.(tareaId, res);
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    } finally {
      setSubtaskEnMovimiento(null);
    }
  };

  const reanudarSubtarea = async (
    tareaId: number,
    subtareaId: number,
    opts?: { modo?: "continuar" | "nueva_fecha" | "mantener"; nuevaFechaEntrega?: string }
  ) => {
    setSubtaskEnMovimiento(subtareaId);
    try {
      await apiReanudar(tareaId, subtareaId, opts);
      const msgs: Record<string, string> = {
        continuar: "Subtarea reanudada: la cuenta regresiva continúa",
        nueva_fecha: "Subtarea reanudada con nueva fecha de entrega",
        mantener: "Subtarea reanudada manteniendo la fecha de entrega",
      };
      showToast(msgs[opts?.modo ?? "continuar"] ?? "Subtarea reanudada", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    } finally {
      setSubtaskEnMovimiento(null);
    }
  };

  const reasignarSubtarea = async (tareaId: number, subtareaId: number, nuevoAsignado: number) => {
    try {
      await apiReasignar(tareaId, subtareaId, nuevoAsignado);
      showToast("Subtarea reasignada", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    }
  };

  const inactivarSubtarea = async (tareaId: number, subtareaId: number) => {
    try {
      const res = await apiInactivar(tareaId, subtareaId);
      showToast("Subtarea inactivada", "success");
      await cargar();
      onSolicitudResuelta?.(tareaId, res);
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    }
  };

  const reactivarSubtarea = async (tareaId: number, subtareaId: number) => {
    try {
      await apiReactivar(tareaId, subtareaId);
      showToast("Subtarea reactivada", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
      throw e;
    }
  };

  return {
    accionando,
    empezandoId,
    completandoId,
    subtaskEnMovimiento,
    iniciar,
    empezarSubtarea,
    completarSubtarea,
    cambiarEstadoSubtarea,
    reanudarSubtarea,
    reasignarSubtarea,
    inactivarSubtarea,
    reactivarSubtarea,
  };
}
