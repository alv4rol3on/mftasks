"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo } from "@/lib/types";

export default function TareasPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const [empezandoId, setEmpezandoId] = useState<number | null>(null);
  const [completandoId, setCompletandoId] = useState<number | null>(null);
  const { showToast } = useToast();
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Task | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);

  // Guard: CLIENTE puro no debe entrar a Tareas en desarrollo
  useEffect(() => {
    const user = getUsuarioActual();
    if (!user) { router.replace("/"); return; }
    const roles = (user.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.includes("administrador");
    const isCliente = roles.includes("cliente");
    const isMiembro = roles.includes("miembro");
    if (isAdmin) return;
    // Si es cliente sin rol miembro -> verificar si es lider/miembro de equipo
    if (isCliente && !isMiembro) {
      // verificar si es lider/miembro -> si lo es, permitir (cliente-miembro)
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = user.id;
          const esMiembro = arr.some((eq) => eq.lider?.id === uid || eq.miembros?.some((m) => m.id_usuario === uid));
          if (!esMiembro) setSinPermiso(true);
        })
        .catch(() => setSinPermiso(true));
    }
  }, [router]);

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

  const cambiarEstadoSubtarea = async (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => {
    // obtener estado actual para decidir endpoint correcto
    const tareaActual = tareas.find((t) => t.id === tareaId);
    const subActual = tareaActual?.subtareas.find((s) => s.id === subtareaId);
    const estadoActual = subActual?.estado;

    try {
      if (nuevoEstado === "STAND_BY") {
        if (!motivo) { showToast("Motivo obligatorio para STAND_BY", "error"); return; }
        // solo desde EN_ESPERA o EN_DESARROLLO
        if (estadoActual !== "EN_ESPERA" && estadoActual !== "EN_DESARROLLO") {
          showToast(`No se puede pausar desde ${estadoActual}`, "error");
          return;
        }
        await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/standby/`, { method: "POST", body: JSON.stringify({ motivo }) });
        showToast("Subtarea en pausa", "success");
      } else if (nuevoEstado === "EN_DESARROLLO") {
        if (estadoActual === "EN_ESPERA") {
          // iniciar
          await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/empezar/`, { method: "POST" });
          showToast("Subtarea iniciada", "success");
        } else if (estadoActual === "STAND_BY") {
          await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/reanudar/`, { method: "POST" });
          showToast("Subtarea reanudada", "success");
        } else {
          showToast(`Transición no válida ${estadoActual} -> ${nuevoEstado}`, "error");
          return;
        }
      } else if (nuevoEstado === "EN_ESPERA") {
        showToast("No se puede volver a En espera", "error");
        return;
      } else if (nuevoEstado === "SOLUCIONADO") {
        if (estadoActual === "SOLUCIONADO") {
          showToast("Ya está solucionada", "error");
          return;
        }
        await apiFetch(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/completar/`, { method: "POST" });
        showToast("Subtarea solucionada", "success");
      }
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE no tienes acceso a Tareas en desarrollo. Usa &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes.</p>
      </div>
    );
  }

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
        onCambiarEstadoSubtarea={cambiarEstadoSubtarea}
      />
    </div>
  );
}