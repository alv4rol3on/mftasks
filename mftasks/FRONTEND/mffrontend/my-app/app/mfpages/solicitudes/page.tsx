"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TaskTableSolicitudes from "@/components/solicitudes/TaskTableSolicitudes";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo } from "@/lib/types";

export default function SolicitudesPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const { showToast } = useToast();
  const [sinPermiso, setSinPermiso] = useState(false);
  const [esSoloLectura, setEsSoloLectura] = useState(false);

  // Guard: CLIENTE puro no debe entrar a Centro de solicitudes (aprobar). ASISTENTE sí pero solo lectura
  useEffect(() => {
    const user = getUsuarioActual();
    if (!user) { router.replace("/"); return; }
    const roles = (user.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.includes("administrador");
    const isCliente = roles.includes("cliente");
    const isAsistente = roles.includes("asistente");
    const isAsignador = roles.includes("asignador");
    if (isAdmin || isAsignador) return; // puede aprobar
    if (isAsistente) { setEsSoloLectura(true); return; }
    // Cliente puro -> bloquear, pero verificar si es lider/sub-lider/miembro (multi-rol)
    if (isCliente && !isAsistente && !isAsignador) {
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = user.id;
          const esSubLider = arr.some((eq) => eq.miembros?.some((m) => m.id_usuario === uid && m.rol_en_equipo === "SUB_LIDER" && m.estado === "ACTIVO"));
          const esLider = arr.some((eq) => eq.lider?.id === uid);
          const esMiembro = arr.some((eq) => eq.miembros?.some((m) => m.id_usuario === uid));
          if (esLider || esSubLider) return; // tiene permiso aprobar
          if (esMiembro) { setEsSoloLectura(true); return; } // miembro asistente-like solo lectura
          setSinPermiso(true);
        })
        .catch(() => setSinPermiso(true));
    } else if (!isCliente) {
      // Sin rol cliente pero tampoco asistente/asignador: verificar si es miembro interno (debe ver solo lectura)
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = user.id;
          const esMiembro = arr.some((eq) => eq.lider?.id === uid || eq.miembros?.some((m) => m.id_usuario === uid));
          if (esMiembro && !isAsignador && !isAdmin) setEsSoloLectura(true);
        })
        .catch(() => {});
    }
  }, [router]);

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
      showToast("tarea aceptada", "success");
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      showToast(msg, "error");
      throw e;
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
      showToast("tarea rechazado", "error");
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      showToast(msg, "error");
      throw e;
    } finally {
      setAccionando(null);
    }
  };

  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE debes usar &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes. El Centro de solicitudes de aprobación es solo para LIDER / SUB-LIDER / ASISTENTE (solo lectura).</p>
      </div>
    );
  }

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