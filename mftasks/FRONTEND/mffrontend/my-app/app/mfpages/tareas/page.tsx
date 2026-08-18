"use client";

import { useCallback, useEffect, useState } from "react";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";

export default function TareasPage() {
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);

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
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAccionando(null);
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
        onIniciar={iniciar}
      />
    </div>
  );
}