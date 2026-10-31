"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TaskTableSolicitudes from "@/components/solicitudes/TaskTableSolicitudes";
import AdminSolicitudesTable from "@/components/solicitudes/AdminSolicitudesTable";
import FiltroCampanaSubcampana from "@/components/filtros/FiltroCampanaSubcampana";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import { fechaEnLima, rangoFechasPorDefecto } from "@/lib/fechas";
import { stripHtml } from "@/lib/richText";
import RefreshButton from "@/components/ui/RefreshButton";
import PageLoader from "@/components/ui/PageLoader";

export default function SolicitudesPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = getUsuarioActual();
  const rolesLower = (user?.roles ?? []).map((r) => r.toLowerCase());
  const isAdmin = rolesLower.includes("administrador");

  const ESTADOS = ["TODOS", "EN_PROCESO", "EN_ESPERA", "APROBADO", "EN_DESARROLLO", "STAND_BY", "SOLUCIONADO", "RECHAZADO", "CANCELADO"] as const;
  const etiquetaEstado = (estado: string) => {
    if (estado === "TODOS") return "Todos los estados";
    if (estado === "EN_PROCESO") return "EN PROCESO";
    return estado.replace(/_/g, " ");
  };

  // filtros
  const [filtroEstado, setFiltroEstado] = useState<string>(isAdmin ? "TODOS" : "EN_ESPERA");
  const [busqueda, setBusqueda] = useState("");
  const [campoFecha, setCampoFecha] = useState<"solicitud" | "entrega">("solicitud");
  const rangoInicial = useMemo(() => rangoFechasPorDefecto(), []);
  const [desde, setDesde] = useState(rangoInicial.desde);
  const [hasta, setHasta] = useState(rangoInicial.hasta);
  const [filtroEntidad, setFiltroEntidad] = useState<number | "">("");
  const [filtroCampana, setFiltroCampana] = useState<number | "">("");
  const [filtroSubcampana, setFiltroSubcampana] = useState<number | "">("");

  // La protección de acceso la resuelve el guard central (redirige a perfil).
  useEffect(() => {
    if (!getUsuarioActual()) {
      router.replace("/");
    }
  }, [router]);

  const cargar = useCallback(() => {
    setCargando(true);
    const params = new URLSearchParams();
    // La bandeja de aprobación (no-admin) solo muestra EN_ESPERA.
    // El Centro de solicitudes (admin) trae todos los estados.
    if (!isAdmin) params.set("estado", "EN_ESPERA");
    if (filtroEntidad) params.set("entidad", String(filtroEntidad));
    if (filtroCampana) params.set("campana", String(filtroCampana));
    if (filtroSubcampana) params.set("subcampana", String(filtroSubcampana));
    apiFetch<Task[]>(`/api/tasks/tasks/?${params.toString()}`)
      .then((data) => {
        setError(null);
        const ordenadas = [...data].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
        setTareas(ordenadas);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [filtroEntidad, filtroCampana, filtroSubcampana, isAdmin]);

  {/*const aprobar = async (tarea: Task) => {
    setError(null);
    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/aprobar/`, { method: "POST" });
      await cargar();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      throw e;
    }
  };*/}

  const aprobar = async (tarea: Task) => {
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/aprobar/`, {
        method: "POST",
      });
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      throw e;
    }
  };

  {/*const rechazar = async (tarea: Task, motivo: string) => {
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
  };*/}

  const rechazar = async (tarea: Task, motivo: string) => {
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/rechazar/`, {
        method: "POST",
        body: JSON.stringify({
          motivo_rechazo: motivo,
        }),
      });
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      throw e;
    }
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const estadoPorDefecto = isAdmin ? "TODOS" : "EN_ESPERA";

  const hayFiltros =
    filtroEstado !== estadoPorDefecto ||
    Boolean(busqueda) ||
    (isAdmin &&
      (campoFecha !== "solicitud" ||
        desde !== rangoInicial.desde ||
        hasta !== rangoInicial.hasta)) ||
    filtroEntidad !== "" ||
    filtroCampana !== "" ||
    filtroSubcampana !== "";

  const limpiarFiltros = () => {
    setFiltroEstado(estadoPorDefecto);
    setBusqueda("");
    setCampoFecha("solicitud");
    setFiltroEntidad("");
    setFiltroCampana("");
    setFiltroSubcampana("");
    const r = rangoFechasPorDefecto();
    setDesde(r.desde);
    setHasta(r.hasta);
  };

  const tareasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return tareas.filter((t) => {
      const coincideEstado =
        filtroEstado === "TODOS"
          ? true
          : filtroEstado === "EN_ESPERA"
            ? t.estado === "EN_ESPERA"
            : filtroEstado === "EN_PROCESO"
              ? t.estado === "EN_DESARROLLO" || t.estado === "STAND_BY" || t.estado === "APROBADO" || t.estado === "EN_ESPERA"
              : t.estado === filtroEstado;
      if (!coincideEstado) return false;

      if (isAdmin) {
        const fecha = campoFecha === "entrega" ? t.fecha_entrega_aproximada : t.fecha_creacion;
        const fechaIso = fechaEnLima(fecha);
        if (!fechaIso) {
          if (desde || hasta) return false;
        } else {
          if (desde && fechaIso < desde) return false;
          if (hasta && fechaIso > hasta) return false;
        }
      }

      if (!texto) return true;
      return (
        (t.ticket ?? "").toLowerCase().includes(texto) ||
        String(t.asunto ?? "").toLowerCase().includes(texto) ||
        stripHtml(t.descripcion).toLowerCase().includes(texto) ||
        String(t.campana_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.subcampana_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.solicitante_nombre ?? "").toLowerCase().includes(texto) ||
        String(t.equipo_nombre ?? "").toLowerCase().includes(texto)
      );
    });
  }, [tareas, filtroEstado, busqueda, campoFecha, desde, hasta, isAdmin]);

  const filtrosUI = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <FiltroCampanaSubcampana
        entidadId={filtroEntidad}
        onEntidadChange={setFiltroEntidad}
        campanaId={filtroCampana}
        subcampanaId={filtroSubcampana}
        onChange={({ campanaId, subcampanaId }) => {
          setFiltroCampana(campanaId);
          setFiltroSubcampana(subcampanaId);
        }}
      />
      {isAdmin && (
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{
            border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 160, background: "var(--color-select)",
            color: "var(--color-text)",
            colorScheme: "light dark"
          }}
        >
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{etiquetaEstado(s)}</option>
          ))}
        </select>
      )}
      {isAdmin && (
        <>
          <select
            value={campoFecha}
            onChange={(e) => setCampoFecha(e.target.value as "solicitud" | "entrega")}
            title="Campo de fecha a filtrar"
            aria-label="Campo de fecha a filtrar"
            style={{
              border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 160, background: "var(--color-select)",
              color: "var(--color-text)",
              colorScheme: "light dark"
            }}
          >
            <option value="solicitud">Fecha de solicitud</option>
            <option value="entrega">Fecha de entrega</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
            Desde
            <input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                background: "var(--color-select)",
                color: "var(--color-text)",
                colorScheme: "light dark"
              }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                background: "var(--color-select)",
                color: "var(--color-text)",
                colorScheme: "light dark"
              }} />
          </label>
        </>
      )}
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por ticket, asunto, descripción..."
        style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240, flex: 1 }}
      />
      {hayFiltros && (
        <button
          onClick={limpiarFiltros}
          style={{ border: "1px solid var(--color-border)", background: "var(--color-background)", color: "var(--color-text)", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}
        >
          Limpiar
        </button>
      )}
    </div>
  );


  if (cargando) return <PageLoader label="Cargando solicitudes…" />;
  if (error) return <div>Error al cargar las solicitudes: {error}</div>;

  if (isAdmin) {
    return (
      <div className="solicitudes-page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <h2 className="text-lg font-medium" style={{ margin: 0 }}>Centro de solicitudes</h2>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{tareasFiltradas.length} de {tareas.length} · Solo lectura</span>
        </div>
        {filtrosUI}
        <AdminSolicitudesTable tareas={tareasFiltradas} onReload={cargar} />
      </div>
    );
  }

  return (
    <div className="solicitudes-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 className="mb-4 text-lg font-medium" style={{ margin: 0 }}>
          Solicitudes recibidas
        </h2>

        <RefreshButton onClick={cargar} loading={cargando} variant="solid" />
      </div>

      {filtrosUI}

      <TaskTableSolicitudes
        tareas={tareasFiltradas}
        onAprobar={aprobar}
        onRechazar={rechazar}
        onReload={cargar}
      />
    </div>
  );
}
