"use client";

import { useState } from "react";
import TaskModal from "./TaskModal";
import TaskIniciarModal from "./TaskIniciarModal";
import styles from "./TaskTableEnDesarrollo.module.css";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";

const formatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatearFecha = (fecha: string | null | undefined) => {
  if (!fecha) return "-";

  const date = new Date(fecha);

  if (isNaN(date.getTime())) return "-";

  return formatter.format(date);
};

interface TaskTableEnDesarrolloProps {
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
}

export default function TaskTableEnDesarrollo({
  tareas,
  accionando,
  empezandoId,
  completandoId,
  onIniciar,
  onEmpezarSubtarea,
  onCompletarSubtarea,
}: TaskTableEnDesarrolloProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskParaIniciar, setTaskParaIniciar] = useState<Task | null>(null);
  const selectedTask =
    tareas.find((tarea) => tarea.id === selectedTaskId) ?? null;
  const usuario = getUsuarioActual();
  const tienePendienteEnTarea = (tarea: Task) =>
    tarea.subtareas.some(
      (s) => s.asignado === usuario?.id && (s.estado === "EN_ESPERA" || s.estado === "EN_DESARROLLO")
    );

  return (
    <>
      <div className={styles.taskTableContainer}>
        <div className={styles.taskTable}>
          <div className={styles.taskHeader}>
            <div>ID</div>
            <div>Asunto</div>
            <div>Cliente</div>
            <div>Equipo</div>
            <div>Estado</div>
            <div>Fecha de inicio</div>
            <div>Acciones</div>
          </div>

          {tareas.map((tarea) => {
            const conPendiente = tienePendienteEnTarea(tarea);
            return (
              <div
                className={styles.taskRow}
                key={tarea.id}
                style={conPendiente ? { background: "#fffbeb", borderLeft: "4px solid #f59e0b" } : undefined}
                title={conPendiente ? "Tienes subtareas pendientes en esta tarea" : undefined}
              >
                <div>{tarea.id} {conPendiente && <span style={{ background: "#f59e0b", color: "white", fontSize: 9, padding: "2px 6px", borderRadius: 999, marginLeft: 4 }}>PENDIENTE TUYO</span>}</div>

                <div className={styles.taskSubject}>
                  {tarea.asunto}
                  {conPendiente && <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>Estás teniendo subtareas pendientes por completar</div>}
                </div>

                <div>{tarea.cliente_nombre}</div>

                <div>{tarea.equipo_nombre}</div>

                <div>{tarea.estado}</div>

                <div>{formatearFecha(tarea.fecha_inicio)}</div>

                <div>
                  <button
                    className={styles.btnDetalles}
                    onClick={() => setSelectedTaskId(tarea.id)}
                  >
                    info
                  </button>
                  {tarea.puedo_operar && tarea.estado === "APROBADO" && (
                    <button
                      className={styles.btnIniciar}
                      onClick={() => setTaskParaIniciar(tarea)}
                      disabled={accionando === tarea.id}
                    >
                      Iniciar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <TaskModal
        tarea={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onEmpezarTarea={onEmpezarSubtarea}
        onCompletarSubtarea={onCompletarSubtarea}
        empezandoId={empezandoId}
        completandoId={completandoId}
      />

      {taskParaIniciar && (
        <TaskIniciarModal
          tarea={taskParaIniciar}
          accionando={accionando === taskParaIniciar.id}
          onClose={() => setTaskParaIniciar(null)}
          onSubmit={onIniciar}
        />
      )}
    </>
  );
}