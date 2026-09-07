"use client";

import { useState } from "react";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { useTareas } from "./hooks/useTareas";
import { useTareasGuard } from "./hooks/useTareasGuard";
import { filtrarTareas } from "./utils/tareasFilters";
import { iniciarTarea, empezarSubtarea as apiEmpezar, completarSubtarea as apiCompletar, cambiarEstadoSubtarea as apiCambiar } from "@/lib/services/tareasService";

export default function TareasPage() {
  const { tareas, cargando, error, busqueda, setBusqueda, cargar, setError } = useTareas();
  const { sinPermiso } = useTareasGuard();
  const { showToast } = useToast();
  const [accionando, setAccionando] = useState<number | null>(null);
  const [empezandoId, setEmpezandoId] = useState<number | null>(null);
  const [completandoId, setCompletandoId] = useState<number | null>(null);

  const iniciar = async (
    tarea: Task,
    payload: { fecha_inicio: string; fecha_entrega_aproximada: string; incluye_sabado: boolean; subtareas: { descripcion: string; asignado: number; peso: number }[] }
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

  if (sinPermiso) {
    return (
      <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 16, borderRadius: 8 }}>
        <p style={{ color: "#991b1b", fontWeight: 600 }}>Acceso denegado</p>
        <p style={{ color: "#7f1d1d", fontSize: 13, marginTop: 4 }}>Como CLIENTE no tienes acceso a Tareas en desarrollo. Usa &quot;Mis Solicitudes&quot; para ver el estado de tus solicitudes.</p>
      </div>
    );
  }
  if (cargando) return <div>Cargando tareas…</div>;
  if (error) return <div>Error al cargar las tareas: {error}</div>;

  const tareasFiltradas = filtrarTareas(tareas, busqueda);
  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    cargar(busqueda);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 className="text-lg font-medium" style={{ margin: 0 }}>Tareas en desarrollo</h2>
        <form onSubmit={handleBuscar} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por ticket o nombre..." style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240 }} />
          {/*<button type="submit" style={{ background: "#111827", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Buscar</button>
          {busqueda && <button type="button" onClick={() => { setBusqueda(""); cargar(""); }} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Limpiar</button>}*/}
        </form>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", marginTop: -8, marginBottom: 12 }}>Por defecto se muestran tareas en proceso o con solución reciente (≤3 días). Usa el buscador para ver anteriores por ticket o nombre.</p>
      <TaskTableEnDesarrollo tareas={tareasFiltradas} accionando={accionando} empezandoId={empezandoId} completandoId={completandoId} onIniciar={iniciar} onEmpezarSubtarea={empezarSubtarea} onCompletarSubtarea={completarSubtarea} onCambiarEstadoSubtarea={cambiarEstadoSubtarea} />
    </div>
  );
}
