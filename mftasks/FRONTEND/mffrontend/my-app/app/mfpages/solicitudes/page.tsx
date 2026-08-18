"use client";

import { useCallback, useEffect, useState } from "react";
import TaskTableSolicitudes from "@/components/solicitudes/TaskTableSolicitudes";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";

export default function SolicitudesPage() {
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);

  const cargar = useCallback(() => {
    apiFetch<Task[]>("/api/tasks/tasks/")
      .then((data) => {
        setError(null);
        setTareas(data.filter((tarea) => tarea.estado === "EN_ESPERA"));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const aprobar = async (tarea: Task) => {
    setAccionando(tarea.id);
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/aprobar/`, {
        method: "POST",
      });
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAccionando(null);
    }
  };

  const rechazar = async (tarea: Task, motivo: string) => {
    setAccionando(tarea.id);
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/rechazar/`, {
        method: "POST",
        body: JSON.stringify({ motivo_rechazo: motivo }),
      });
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAccionando(null);
    }
  };

  if (cargando) {
    return <div>Cargando solicitudes…</div>;
  }

  if (error) {
    return <div>Error al cargar las solicitudes: {error}</div>;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">
        Solicitudes recibidas
      </h2>

      <TaskTableSolicitudes
        tareas={tareas}
        accionando={accionando}
        onAprobar={aprobar}
        onRechazar={rechazar}
      />
    </div>
  );
}