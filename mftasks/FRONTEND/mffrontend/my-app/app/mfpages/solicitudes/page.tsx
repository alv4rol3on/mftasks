"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TaskTableSolicitudes from "@/components/solicitudes/TaskTableSolicitudes";
import AdminSolicitudesTable from "@/components/solicitudes/AdminSolicitudesTable";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo } from "@/lib/types";

const ESTADOS = ["TODOS", "EN_ESPERA", "APROBADO", "EN_DESARROLLO", "STAND_BY", "SOLUCIONADO", "RECHAZADO"] as const;

export default function SolicitudesPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);
  const { showToast } = useToast();
  const [sinPermiso, setSinPermiso] = useState(false);
  const [esSoloLectura, setEsSoloLectura] = useState(false);
  // admin filtros
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const user = getUsuarioActual();
  const isAdmin = (user?.roles ?? []).map((r) => r.toLowerCase()).includes("administrador");

  // Guard: CLIENTE puro no debe entrar. ADMIN pasa directo (ahora unificada, no aprobar)
  useEffect(() => {
    const u = getUsuarioActual();
    if (!u) { router.replace("/"); return; }
    const roles = (u.roles ?? []).map((r) => r.toLowerCase());
    const isAd = roles.includes("administrador");
    const isCliente = roles.includes("cliente");
    const isAsistente = roles.includes("asistente");
    const isAsignador = roles.includes("asignador");
    if (isAd) return; // admin unificada
    if (isAsignador) return;
    if (isAsistente) { setEsSoloLectura(true); return; }
    if (isCliente && !isAsistente && !isAsignador) {
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = u.id;
          const esSubLider = arr.some((eq) => eq.miembros?.some((m) => m.id_usuario === uid && m.rol_en_equipo === "SUB_LIDER" && m.estado === "ACTIVO"));
          const esLider = arr.some((eq) => eq.lider?.id === uid);
          const esMiembro = arr.some((eq) => eq.miembros?.some((m) => m.id_usuario === uid));
          if (esLider || esSubLider) return;
          if (esMiembro) { setEsSoloLectura(true); return; }
          setSinPermiso(true);
        })
        .catch(() => setSinPermiso(true));
    } else if (!isCliente) {
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = u.id;
          const esMiembro = arr.some((eq) => eq.lider?.id === uid || eq.miembros?.some((m) => m.id_usuario === uid));
          if (esMiembro && !isAsignador && !isAd) setEsSoloLectura(true);
        })
        .catch(() => {});
    }
  }, [router]);

  const cargar = useCallback(() => {
    setCargando(true);
    apiFetch<Task[]>("/api/tasks/tasks/")
      .then((data) => {
        setError(null);
        if (isAdmin) {
          // admin ve todas, orden más reciente primero
          const ordenadas = [...data].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
          setTareas(ordenadas);
        } else {
          setTareas(data.filter((tarea) => tarea.estado === "EN_ESPERA"));
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [isAdmin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const aprobar = async (tarea: Task) => {
    setAccionando(tarea.id);
    setError(null);
    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/aprobar/`, { method: "POST" });
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
      await apiFetch(`/api/tasks/tasks/${tarea.id}/rechazar/`, { method: "POST", body: JSON.stringify({ motivo_rechazo: motivo }) });
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

  const tareasFiltradasAdmin = useMemo(() => {
    if (!isAdmin) return tareas;
    let out = tareas;
    if (filtroEstado !== "TODOS") out = out.filter((t) => t.estado === filtroEstado);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (t) =>
          (t.ticket ?? "").toLowerCase().includes(q) ||
          t.asunto.toLowerCase().includes(q) ||
          t.descripcion.toLowerCase().includes(q) ||
          (t.campana_nombre ?? "").toLowerCase().includes(q) ||
          (t.solicitante_nombre ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [tareas, filtroEstado, busqueda, isAdmin]);

  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE debes usar &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes. El Centro de solicitudes de aprobación es solo para LIDER / SUB-LIDER / ASISTENTE (solo lectura).</p>
      </div>
    );
  }

  if (cargando) return <div>Cargando solicitudes…</div>;
  if (error) return <div>Error al cargar las solicitudes: {error}</div>;

  if (isAdmin) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <h2 className="text-lg font-medium" style={{ margin: 0 }}>Solicitudes</h2>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{tareasFiltradasAdmin.length} de {tareas.length} · Solo lectura + inactivar</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 160, background: "white" }}
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>{s === "TODOS" ? "Todos los estados" : s}</option>
            ))}
          </select>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ticket, asunto, descripción..."
            style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240, flex: 1 }}
          />
          {(busqueda || filtroEstado !== "TODOS") && (
            <button
              onClick={() => { setBusqueda(""); setFiltroEstado("TODOS"); }}
              style={{ border: "1px solid #d1d5db", background: "white", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}
            >
              Limpiar
            </button>
          )}
        </div>
        <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Ordenadas de la más reciente a la más antigua. Responsive con filtros por estado y buscador. Solo lectura e inactivar.</p>
        <AdminSolicitudesTable tareas={tareasFiltradasAdmin} onReload={cargar} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Solicitudes recibidas</h2>
      <TaskTableSolicitudes tareas={tareas} accionando={accionando} onAprobar={aprobar} onRechazar={rechazar} />
    </div>
  );
}
