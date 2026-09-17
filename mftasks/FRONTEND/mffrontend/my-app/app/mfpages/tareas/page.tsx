"use client";

import { useEffect, useMemo, useState } from "react";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { useTasksWebSocket } from "@/app/providers/TasksWebSocketProvider";
import { useTareas } from "./hooks/useTareas";
import { useTareasGuard } from "./hooks/useTareasGuard";
import { ESTADOS_TAREA } from "./utils/tareasFilters";
import { iniciarTarea, empezarSubtarea as apiEmpezar, completarSubtarea as apiCompletar, cambiarEstadoSubtarea as apiCambiar, reanudarSubtarea as apiReanudarSubtarea, reasignarSubtarea as apiReasignar, inactivarSubtarea as apiInactivar, reactivarSubtarea as apiReactivar, type EstadoFiltro, type CampoFecha, type FiltrosTareas } from "@/lib/services/tareasService";

export default function TareasPage() {
  const { eventos, subtareaEventos, observarTarea, dejarDeObservarTarea } = useTasksWebSocket();
  const { sinPermiso } = useTareasGuard();
  const { showToast } = useToast();
  const [accionando, setAccionando] = useState<number | null>(null);
  const [empezandoId, setEmpezandoId] = useState<number | null>(null);
  const [completandoId, setCompletandoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>("TODOS");
  const [campoFecha, setCampoFecha] = useState<CampoFecha>("solicitud");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const filtros = useMemo<FiltrosTareas>(
    () => ({ busqueda, estado: filtroEstado, campoFecha, desde, hasta }),
    [busqueda, filtroEstado, campoFecha, desde, hasta]
  );
  const { tareas, cargando, error, cargar, setTareas, setError } = useTareas(filtros);

  const idsTareas = useMemo(() => tareas.map((t) => t.id), [tareas]);
  const idsTareasKey = idsTareas.join(",");

  const hayFiltros = filtroEstado !== "TODOS" || !!desde || !!hasta || !!busqueda;
  const limpiarFiltros = () => {
    setFiltroEstado("TODOS");
    setCampoFecha("solicitud");
    setDesde("");
    setHasta("");
    setBusqueda("");
    cargar({ busqueda: "", estado: "TODOS", campoFecha: "solicitud", desde: "", hasta: "" });
  };

  useEffect(() => {
    idsTareas.forEach((id) => observarTarea(id));

    return () => {
      idsTareas.forEach((id) => dejarDeObservarTarea(id));
    };
  }, [idsTareasKey, observarTarea, dejarDeObservarTarea]);

  useEffect(() => {
    if (
      Object.keys(eventos).length === 0 &&
      Object.keys(subtareaEventos).length === 0
    ) {
      return;
    }

    setTareas((actuales) =>
      actuales.map((tarea) => {
        const evento = eventos[tarea.id];

        let actualizada = tarea;

        if (evento && evento.type === "task_status_changed") {
          actualizada = {
            ...actualizada,
            estado: evento.estado_nuevo
              ? String(evento.estado_nuevo)
              : actualizada.estado,
            progreso:
              typeof evento.progreso === "number"
                ? String(evento.progreso)
                : actualizada.progreso,
            activo:
              typeof evento.activo === "boolean"
                ? evento.activo
                : actualizada.activo,
          };
        }

        if (actualizada.subtareas?.length) {
          actualizada = {
            ...actualizada,
            subtareas: actualizada.subtareas.map((s) => {
              const eventoSub = subtareaEventos[s.id];

              if (!eventoSub || eventoSub.type !== "subtask_status_changed") {
                return s;
              }

              return {
                ...s,
                estado: eventoSub.estado_nuevo
                  ? String(eventoSub.estado_nuevo)
                  : s.estado,
                activo:
                  typeof eventoSub.activo === "boolean"
                    ? eventoSub.activo
                    : s.activo,
              };
            }),
          };
        }

        return actualizada;
      })
    );
  }, [eventos, subtareaEventos, setTareas]);

  const iniciar = async (
    tarea: Task,
    payload: { fecha_inicio: string; fecha_entrega_aproximada: string; subtareas: { descripcion: string; asignado: number; peso: number }[] }
  ) => {
    setAccionando(tarea.id);
    setError(null);
    try {
      await iniciarTarea(tarea.id, payload);
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

  const empezarSubtarea = async (tareaId: number, subtareaId: number) => {
    setEmpezandoId(subtareaId);
    try {
      await apiEmpezar(tareaId, subtareaId);
      showToast("Subtarea iniciada", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setEmpezandoId(null);
    }
  };

  const completarSubtarea = async (tareaId: number, subtareaId: number) => {
    setCompletandoId(subtareaId);
    try {
      await apiCompletar(tareaId, subtareaId);
      showToast("Subtarea completada", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setCompletandoId(null);
    }
  };

  const cambiarEstadoSubtarea = async (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => {
    const tareaActual = tareas.find((t) => t.id === tareaId);
    const subActual = tareaActual?.subtareas.find((s) => s.id === subtareaId);
    const estadoActual = subActual?.estado;
    try {
      if (nuevoEstado === "STAND_BY" && !motivo) {
        showToast("Motivo obligatorio para STAND_BY", "error");
        return;
      }
      await apiCambiar(tareaId, subtareaId, nuevoEstado, motivo, estadoActual);
      const msgs: Record<string, string> = {
        STAND_BY: "Subtarea en pausa",
        EN_DESARROLLO: estadoActual === "STAND_BY" ? "Subtarea reanudada" : "Subtarea iniciada",
        EN_ESPERA: "Subtarea reanudada a En espera",
        SOLUCIONADO: "Subtarea solucionada",
      };
      showToast(msgs[nuevoEstado] ?? "Estado actualizado", "success");
      await cargar();
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const reanudarSubtarea = async (
    tareaId: number,
    subtareaId: number,
    opts?: { modo?: "continuar" | "nueva_fecha" | "mantener"; nuevaFechaEntrega?: string }
  ) => {
    try {
      await apiReanudarSubtarea(tareaId, subtareaId, opts);
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
      await apiInactivar(tareaId, subtareaId);
      showToast("Subtarea inactivada", "success");
      await cargar();
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

  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE no tienes acceso a Tareas en desarrollo. Usa &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes.</p>
      </div>
    );
  }
  // admin redirect ya hecho en guard, pero fallback render
  if (typeof window !== "undefined") {
    const u = (() => { try { const g = localStorage.getItem("user"); return g ? JSON.parse(g) : null; } catch { return null; } })();
    if (u && (u.roles ?? []).map((r: string)=>r.toLowerCase()).includes("administrador")) {
      return <div style={{ padding: 16, color: "#6b7280" }}>Redirigiendo a Solicitudes...</div>;
    }
  }
  if (cargando) return <div>Cargando tareas…</div>;
  if (error) return <div>Error al cargar las tareas: {error}</div>;

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    cargar({ busqueda });
  };

  const selectStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white", minWidth: 160 };
  const inputStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" };
  const fechaLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" };
  const clearBtnStyle: React.CSSProperties = { border: "1px solid #d1d5db", background: "white", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <h2 className="text-lg font-medium" style={{ margin: 0 }}>Tareas en desarrollo</h2>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{tareas.length} resultado(s)</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoFiltro)} style={selectStyle} title="Filtrar por estado">
          {ESTADOS_TAREA.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={campoFecha} onChange={(e) => setCampoFecha(e.target.value as CampoFecha)} style={selectStyle} title="Campo de fecha a filtrar">
          <option value="solicitud">Fecha de solicitud</option>
          <option value="entrega">Fecha de entrega</option>
        </select>
        <label style={fechaLabelStyle}>
          Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} style={inputStyle} />
        </label>
        <label style={fechaLabelStyle}>
          Hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} style={inputStyle} />
        </label>
        <form onSubmit={handleBuscar} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por ticket o nombre..." style={{ ...inputStyle, minWidth: 240 }} />
        </form>
        {hayFiltros && (
          <button type="button" onClick={limpiarFiltros} style={clearBtnStyle}>Limpiar</button>
        )}
      </div>
      <TaskTableEnDesarrollo tareas={tareas} accionando={accionando} empezandoId={empezandoId} completandoId={completandoId} onIniciar={iniciar} onEmpezarSubtarea={empezarSubtarea} onCompletarSubtarea={completarSubtarea} onCambiarEstadoSubtarea={cambiarEstadoSubtarea} onReanudarSubtarea={reanudarSubtarea} onReasignarSubtarea={reasignarSubtarea} onInactivarSubtarea={inactivarSubtarea} onReactivarSubtarea={reactivarSubtarea} onTareaMutated={cargar} />
    </div>
  );
}
