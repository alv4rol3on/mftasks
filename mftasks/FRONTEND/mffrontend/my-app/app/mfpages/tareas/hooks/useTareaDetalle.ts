"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTasksWebSocket } from "@/app/providers/TasksWebSocketProvider";
import { fetchTarea } from "@/lib/services/tareasService";
import type { Task } from "@/lib/types";

export function useTareaDetalle(tareaId: number | null) {
  const [tarea, setTarea] = useState<Task | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { eventos, subtareaEventos, observarTarea, dejarDeObservarTarea } = useTasksWebSocket();
  const reqId = useRef(0);
  const primeraVersion = useRef(true);

  const cargar = useCallback(async () => {
    if (!tareaId) {
      setCargando(false);
      return;
    }

    const id = ++reqId.current;
    try {
      const data = await fetchTarea(tareaId);
      if (id !== reqId.current) return;
      setTarea(data);
      setError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      setError((e as Error).message);
    } finally {
      if (id === reqId.current) setCargando(false);
    }
  }, [tareaId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setTarea(null);
    setError(null);
    primeraVersion.current = true;
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!tareaId) return;
    observarTarea(tareaId);
    return () => dejarDeObservarTarea(tareaId);
  }, [tareaId, observarTarea, dejarDeObservarTarea]);

  const eventoVersion = tareaId !== null && eventos[tareaId]
    ? JSON.stringify(eventos[tareaId])
    : "";

  const subtareaVersion = useMemo(() => {
    if (tareaId === null) return "";
    return Object.values(subtareaEventos)
      .filter((evento) => evento.task_id === tareaId)
      .map((evento) => `${evento.subtarea_id}:${evento.estado_nuevo ?? ""}:${evento.activo ?? ""}`)
      .join("|");
  }, [subtareaEventos, tareaId]);

  useEffect(() => {
    if (primeraVersion.current) {
      primeraVersion.current = false;
      return;
    }
    if (!tareaId) return;

    const timer = setTimeout(() => {
      void cargar();
    }, 300);

    return () => clearTimeout(timer);
  }, [eventoVersion, subtareaVersion, tareaId, cargar]);

  const refreshKey = useMemo(() => {
    if (!tarea) return "";
    return [
      tarea.id,
      tarea.estado,
      tarea.progreso,
      tarea.fecha_entrega_aproximada ?? "",
      (tarea.subtareas ?? []).map((s) => `${s.id}:${s.estado}:${s.activo ?? true}`).join(","),
    ].join("|");
  }, [tarea]);

  return {
    tarea,
    cargando,
    error,
    cargar,
    setTarea,
    setError,
    refreshKey,
  };
}
