"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TaskTableSolicitudes from "@/components/solicitudes/TaskTableSolicitudes";
import AdminSolicitudesTable from "@/components/solicitudes/AdminSolicitudesTable";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import { fechaEnLima, rangoFechasPorDefecto } from "@/lib/fechas";
import type { EquipoInfo } from "@/lib/types";

export default function SolicitudesPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);

  const user = getUsuarioActual();
  const rolesLower = (user?.roles ?? []).map((r) => r.toLowerCase());
  const isAdmin = rolesLower.includes("administrador");

  // filtros
  const [filtroEstado, setFiltroEstado] = useState<string>("EN_ESPERA");
  const [busqueda, setBusqueda] = useState("");
  const [campoFecha, setCampoFecha] = useState<"solicitud" | "entrega">("solicitud");
  const rangoInicial = useMemo(() => rangoFechasPorDefecto(), []);
  const [desde, setDesde] = useState(rangoInicial.desde);
  const [hasta, setHasta] = useState(rangoInicial.hasta);

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
    if (isAsistente) return;
    if (isCliente && !isAsistente && !isAsignador) {
      apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
        .then((data) => {
          const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
          const uid = u.id;
          const esGtr = arr.some((eq) => eq.miembros?.some((m) => m.id_usuario === uid && (m.rol_en_equipo === "LIDER" || m.rol_en_equipo === "SUB_LIDER") && m.estado === "ACTIVO"));
          const esLider = arr.some((eq) => eq.lider?.id === uid);
          const esMiembro = arr.some((eq) => eq.miembros?.some((m) => m.id_usuario === uid));
          if (esLider || esGtr) return;
          if (esMiembro) return;
          setSinPermiso(true);
        })
        .catch(() => setSinPermiso(true));
    }
  }, [router]);

  const cargar = useCallback(() => {
    setCargando(true);
    apiFetch<Task[]>("/api/tasks/tasks/?estado=EN_ESPERA")
      .then((data) => {
        setError(null);
        // La bandeja de solicitudes solo muestra las que están EN_ESPERA
        // (el backend ya filtra por estado; orden más reciente primero).
        const ordenadas = [...data].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
        setTareas(ordenadas);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  const aprobar = async (tarea: Task) => {
    setError(null);
    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/aprobar/`, { method: "POST" });
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      throw e;
    }
  };

  const rechazar = async (tarea: Task, motivo: string) => {
    setError(null);
    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/rechazar/`, {
        method: "POST",
        body: JSON.stringify({ motivo_rechazo: motivo }),
      });
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      throw e;
    }
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hayFiltros =
    filtroEstado !== "EN_ESPERA" ||
    Boolean(busqueda) ||
    desde !== rangoInicial.desde ||
    hasta !== rangoInicial.hasta;

  const limpiarFiltros = () => {
    setFiltroEstado("EN_ESPERA");
    setBusqueda("");
    setCampoFecha("solicitud");
    const r = rangoFechasPorDefecto();
    setDesde(r.desde);
    setHasta(r.hasta);
  };

  const tareasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return tareas.filter((t) => {
      const coincideEstado =
        filtroEstado === "EN_ESPERA"
          ? t.estado === "EN_ESPERA"
          : filtroEstado === "EN_PROCESO"
            ? t.estado === "EN_DESARROLLO" || t.estado === "STAND_BY" || t.estado === "APROBADO" || t.estado === "EN_ESPERA"
            : t.estado === filtroEstado;
      if (!coincideEstado) return false;

      const fecha = campoFecha === "entrega" ? t.fecha_entrega_aproximada : t.fecha_creacion;
      const fechaIso = fechaEnLima(fecha);
      if (!fechaIso) {
        if (desde || hasta) return false;
      } else {
        if (desde && fechaIso < desde) return false;
        if (hasta && fechaIso > hasta) return false;
      }

      if (!texto) return true;
      return (
        (t.ticket ?? "").toLowerCase().includes(texto) ||
        String(t.asunto ?? "").toLowerCase().includes(texto) ||
        String(t.descripcion ?? "").toLowerCase().includes(texto) ||
        String(t.campana_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.subcampana_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.solicitante_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.equipo_nombre ?? "").toLowerCase().includes(texto)
      );
    });
  }, [tareas, filtroEstado, busqueda, campoFecha, desde, hasta]);

  const filtrosUI = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      {/*<select
        value={filtroEstado}
        onChange={(e) => setFiltroEstado(e.target.value)}
        style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 160, background: "white" }}
      >
        {ESTADOS.map((s) => (
          <option key={s} value={s}>{etiquetaEstado(s)}</option>
        ))}
      </select>*/}
      {/*<select
        value={campoFecha}
        onChange={(e) => setCampoFecha(e.target.value as "solicitud" | "entrega")}
        title="Campo de fecha a filtrar"
        style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 160, background: "white" }}
      >
        <option value="solicitud">Fecha de solicitud</option>
        <option value="entrega">Fecha de entrega</option>
      </select>*/}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
        Desde
        <input
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => setDesde(e.target.value)}
          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" }}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
        Hasta
        <input
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => setHasta(e.target.value)}
          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" }}
        />
      </label>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por ticket, asunto, descripción..."
        style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240, flex: 1 }}
      />
      {hayFiltros && (
        <button
          onClick={limpiarFiltros}
          style={{ border: "1px solid #d1d5db", background: "white", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}
        >
          Limpiar
        </button>
      )}
    </div>
  );


  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE debes usar &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes. La bandeja de solicitudes de aprobación es solo para GTR / ASISTENTE (solo lectura).</p>
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
          <span style={{ fontSize: 12, color: "#6b7280" }}>{tareasFiltradas.length} de {tareas.length} · Solo lectura</span>
        </div>
        {filtrosUI}
        <AdminSolicitudesTable tareas={tareasFiltradas} onReload={cargar} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Solicitudes recibidas</h2>
      {filtrosUI}
      <TaskTableSolicitudes tareas={tareasFiltradas} onAprobar={aprobar} onRechazar={rechazar} />
    </div>
  );
}
