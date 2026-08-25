"use client";

import { useCallback, useEffect, useState } from "react";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export default function TareasPage() {
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const [empezandoId, setEmpezandoId] = useState<number | null>(null);
  const [completandoId, setCompletandoId] = useState<number | null>(null);
  const { showToast } = useToast();
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Task | null>(null);

  const cargar = useCallback(() => {
    apiFetch<Task[]>("/api/tasks/tasks/")
      .then((data) => {
        setError(null);
        setTareas(
          data.filter(
            (tarea) =>
              tarea.estado === "APROBADO" || tarea.estado === "EN_DESARROLLO"
          )
        );
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const iniciar = async (
    tarea: Task,
    payload: {
      fecha_inicio: string;
      fecha_entrega_aproximada: string;
      subtareas: { descripcion: string; asignado: number; peso: number }[];
    }
  ) => {
    setAccionando(tarea.id);
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/iniciar/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Tarea iniciada correctamente", "success");
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      showToast(msg, "error");
    } finally {
      setAccionando(null);
    }
  };

  const empezarSubtarea = async (
    tareaId: number,
    subtareaId: number
  ) => {
    setEmpezandoId(subtareaId);

    try {
      await apiFetch(
        `/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/empezar/`,
        {
          method: "POST",
        }
      );

      showToast("Subtarea iniciada", "success");

      await cargar();
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setEmpezandoId(null);
    }
  };

  const completarSubtarea = async (tareaId: number, subtareaId: number) => {
    setCompletandoId(subtareaId);

    try {
      await apiFetch(
        `/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/completar/`,
        {
          method: "POST",
        }
      );

      showToast("Subtarea completada", "success");

      await cargar();

      // Cerrar el popup
      //setTareaSeleccionada(null);

    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setCompletandoId(null);
    }
  };

  if (cargando) {
    return <div>Cargando tareas…</div>;
  }

  if (error) {
    return <div>Error al cargar las tareas: {error}</div>;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">
        Tareas en desarrollo
      </h2>

      <TaskTableEnDesarrollo
        tareas={tareas}
        accionando={accionando}
        empezandoId={empezandoId}
        completandoId={completandoId}
        onIniciar={iniciar}
        onEmpezarSubtarea={empezarSubtarea}
        onCompletarSubtarea={completarSubtarea}
      />
    </div>
  );
}