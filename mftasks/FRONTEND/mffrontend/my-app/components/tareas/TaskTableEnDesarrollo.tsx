"use client";

import { useState, useEffect, useMemo } from "react";
import TaskModal from "./TaskModal";
//import TaskIniciarModal from "./TaskIniciarModal";
import styles from "../shared/SharedTable.module.css";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import TaskCountdown from "./TaskCountdown";
import Pagination from "../ui/Pagination";
import { ContadoresProvider, useContador } from "./ContadoresProvider";

const fmtSolicitud = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatearFechaSolicitud(fecha: string | null | undefined): string {
  if (!fecha) return "-";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "-";
  // "07/09/2026, 14:30" -> "07/09/2026 14:30"
  return fmtSolicitud.format(d).replace(",", "");
}

function estadoBadge(estado: string, fueraDeTiempo = false) {
  if (fueraDeTiempo && estado === "EN_DESARROLLO") {
    return { bg: "#fee2e2", color: "#991b1b", border: "#f87171", icon: "⚠", label: "FUERA DE TIEMPO" };
  }
  const map: Record<string, { bg: string; color: string; border: string; icon: string; label: string }> = {
    APROBADO: { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe", icon: "✓", label: "APROBADO" },
    EN_DESARROLLO: { bg: "#dbeafe", color: "#1e3a8a", border: "#2563eb", icon: "▶", label: "EN DESARROLLO" },
    STAND_BY: { bg: "#fef3c7", color: "#78350f", border: "#d97706", icon: "⏸", label: "STAND BY" },
    SOLUCIONADO: { bg: "#dcfce7", color: "#14532d", border: "#16a34a", icon: "✓", label: "SOLUCIONADO" },
    EN_ESPERA: { bg: "#e5e7eb", color: "#1f2937", border: "#9ca3af", icon: "⏳", label: "EN ESPERA" },
    RECHAZADO: { bg: "#fee2e2", color: "#991b1b", border: "#fecaca", icon: "✕", label: "RECHAZADO" },
  };
  return map[estado] ?? { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb", icon: "", label: estado };
}

function FilaTarea({
  tarea,
  conPendiente,
  onSelect,
}: {
  tarea: Task;
  conPendiente: boolean;
  onSelect: (id: number) => void;
}) {
  const contador = useContador(tarea.id);
  const fueraDeTiempo = tarea.estado === "EN_DESARROLLO" && !!contador?.con_retraso;

  const rowClass =
    tarea.estado === "SOLUCIONADO"
      ? styles.rowSolucionado
      : tarea.estado === "STAND_BY"
        ? styles.rowStandBy
        : conPendiente
          ? styles.rowPendiente
          : "";
  const borderLeft =
    tarea.estado === "SOLUCIONADO"
      ? "4px solid #22c55e"
      : tarea.estado === "STAND_BY"
        ? "4px solid #f59e0b"
        : fueraDeTiempo
          ? "4px solid #dc2626"
          : conPendiente
            ? "4px solid #050505"
            : undefined;
  const b = estadoBadge(tarea.estado, fueraDeTiempo);

  return (
    <tr
      className={rowClass}
      style={{
        ...(borderLeft ? { borderLeft } : undefined),
        cursor: "pointer",
      }}
      onClick={() => onSelect(tarea.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(tarea.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalles de ${tarea.asunto}`}
      title={
        fueraDeTiempo
          ? "Tarea fuera de tiempo — clic para ver detalles"
          : conPendiente
            ? "Tienes subtareas pendientes — clic para ver detalles"
            : tarea.estado === "SOLUCIONADO"
              ? "Tarea solucionada — clic para ver detalles"
              : "Clic para ver detalles"
      }
    >
      <td data-label="Fecha solicitud" style={{ whiteSpace: "nowrap", fontSize: 13, color: "#374151" }}>
        {formatearFechaSolicitud(tarea.fecha_creacion)}
      </td>
      <td data-label="Solicitud" className={styles.taskSubject}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: "#1d3557" }}>
            {tarea.subcampana_nombre
              ? `${tarea.campana_nombre}-${tarea.subcampana_nombre}: ${tarea.asunto}`
              : `${tarea.campana_nombre ?? "-"}: ${tarea.asunto}`}
          </span>
        </span>
        <span style={{ display: "block", fontSize: 11, color: "#6b7280", fontWeight: 400, marginTop: 4 }}>
          Ticket {tarea.ticket ?? `#${tarea.id}`}
        </span>
        {conPendiente && (
          <span style={{ display: "block", fontSize: 11, color: "#92400e", marginTop: 2 }}>
            Tienes subtareas pendientes por completar
          </span>
        )}
      </td>
      <td data-label="Estado">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
          <span aria-hidden="true">{b.icon}</span> {b.label}
        </span>
      </td>
      <td data-label="Contador" style={{ whiteSpace: "nowrap" }}>
        {tarea.estado === "APROBADO" ? <span style={{display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "4px"}}>Por asignar</span>
        : tarea.estado === "RECHAZADO" ? <span style={{display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "4px"}}>X</span>
        : <TaskCountdown tareaId={tarea.id} /> }
      </td>
    </tr>
  );
}

export default function TaskTableEnDesarrollo({
  tareas,
  accionando,
  empezandoId,
  completandoId,
  onIniciar,
  onEmpezarSubtarea,
  onCompletarSubtarea,
  onCambiarEstadoSubtarea,
  onReanudarSubtarea,
  onReasignarSubtarea,
  onInactivarSubtarea,
  onReactivarSubtarea,
  onTareaMutated,
}: {
  tareas: Task[];
  accionando?: number | null;
  empezandoId?: number | null;
  completandoId?: number | null;
  onIniciar: (
    tarea: Task,
    payload: {
      fecha_inicio: string;
      fecha_entrega_aproximada: string;
      subtareas: { descripcion: string; asignado: number; peso: number }[];
    }
  ) => void;
  onEmpezarSubtarea?: (tareaId: number, subtareaId: number) => void;
  onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
  onCambiarEstadoSubtarea?: (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => void;
  onReanudarSubtarea?: (tareaId: number, subtareaId: number, opts?: { modo?: "continuar" | "nueva_fecha" | "mantener"; nuevaFechaEntrega?: string }) => Promise<void>;
  onReasignarSubtarea?: (tareaId: number, subtareaId: number, nuevoAsignado: number) => Promise<void>;
  onInactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
  onReactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
  onTareaMutated?: () => void | Promise<void>;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  //const [taskParaIniciar, setTaskParaIniciar] = useState<Task | null>(null);
  const selectedTask = tareas.find((tarea) => tarea.id === selectedTaskId) ?? null;
  const usuario = getUsuarioActual();
  const tienePendienteEnTarea = (tarea: Task) =>
    tarea.subtareas.some(
      (s) => s.activo !== false && s.asignado === usuario?.id && (s.estado === "EN_ESPERA" || s.estado === "EN_DESARROLLO")
    );

  const tareasVisibles = tareas.filter((tarea) => tarea.estado !== "EN_ESPERA");

  // ordenar del más nuevo al más antiguo por fecha de solicitud (fecha_creacion DESC)
  const tareasOrdenadas = useMemo(
    () => [...tareasVisibles].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()),
    [tareasVisibles]
  );

  const pageSize = 10;
  const [pagina, setPagina] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tareasOrdenadas.length / pageSize));
  const paginaClamped = Math.min(pagina, totalPages);
  const tareasPaginadas = useMemo(
    () => tareasOrdenadas.slice((paginaClamped - 1) * pageSize, paginaClamped * pageSize),
    [tareasOrdenadas, paginaClamped]
  );

  useEffect(() => {
    setPagina(1);
  }, [tareas.length]);

  // si cambia total y pagina queda fuera de rango, clamp
  useEffect(() => {
    if (pagina > totalPages) setPagina(totalPages);
  }, [pagina, totalPages]);

  // ids visibles para contadores centralizados (1 poll + 1 tick global)
  const visibleIds = useMemo(() => tareasPaginadas.map((t) => t.id), [tareasPaginadas]);

  // Firma de datos: cambia en cada mutación (estado, progreso, fecha, subtareas) y
  // dispara un refresco inmediato de los contadores.
  const refreshKey = useMemo(
    () =>
      tareasVisibles
        .map(
          (t) =>
            `${t.id}:${t.estado}:${t.progreso}:${t.fecha_entrega_aproximada ?? ""}:${(t.subtareas ?? [])
              .map((s) => `${s.id}:${s.estado}`)
              .join(",")}`
        )
        .join("|"),
    [tareasVisibles]
  );

  return (
    <ContadoresProvider ids={visibleIds} refreshKey={refreshKey}>
      <div className={styles.taskTableContainer}>
        {tareasVisibles.length === 0 ? (
          <div className={styles.noTasks}>No hay tareas en desarrollo</div>
        ) : (
          <table className={styles.taskTable}>
          <thead>
            <tr>
              <th>Fecha solicitud</th>
              <th>Solicitud</th>
              <th>Estado</th>
              <th>Contador</th>
            </tr>
          </thead>
          <tbody>
            {tareasPaginadas.map((tarea) => (
              <FilaTarea
                key={tarea.id}
                tarea={tarea}
                conPendiente={tienePendienteEnTarea(tarea)}
                onSelect={setSelectedTaskId}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
    {tareasOrdenadas.length > 0 && (
      <Pagination page={paginaClamped} totalPages={totalPages} totalItems={tareasOrdenadas.length} pageSize={pageSize} onPageChange={setPagina} />
    )}

    <TaskModal
      tarea={selectedTask}
      onClose={() => setSelectedTaskId(null)}
      onEmpezarTarea={onEmpezarSubtarea}
      onCompletarSubtarea={onCompletarSubtarea}
      onCambiarEstadoSubtarea={onCambiarEstadoSubtarea}
      onReanudarSubtarea={onReanudarSubtarea}
      empezandoId={empezandoId}
      completandoId={completandoId}
      accionando={accionando}
      onIniciar={onIniciar}
      onReasignarSubtarea={onReasignarSubtarea}
      onInactivarSubtarea={onInactivarSubtarea}
      onReactivarSubtarea={onReactivarSubtarea}
      onTareaMutated={onTareaMutated}
    />

    {/*{taskParaIniciar && (
      <TaskIniciarModal
        tarea={taskParaIniciar}
        accionando={accionando === taskParaIniciar.id}
        onClose={() => setTaskParaIniciar(null)}
        onSubmit={onIniciar}
      />
    )}*/}
    </ContadoresProvider>
  );
}
