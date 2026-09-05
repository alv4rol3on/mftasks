"use client";

import { useState } from "react";
import TaskModal from "./TaskModal";
import TaskIniciarModal from "./TaskIniciarModal";
import styles from "../shared/SharedTable.module.css";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import TaskCountdown from "./TaskCountdown";

export default function TaskTableEnDesarrollo({
  tareas,
  accionando,
  empezandoId,
  completandoId,
  onIniciar,
  onEmpezarSubtarea,
  onCompletarSubtarea,
  onCambiarEstadoSubtarea,
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
      incluye_sabado: boolean;
      subtareas: { descripcion: string; asignado: number; peso: number }[];
    }
  ) => void;
  onEmpezarSubtarea?: (tareaId: number, subtareaId: number) => void;
  onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
  onCambiarEstadoSubtarea?: (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskParaIniciar, setTaskParaIniciar] = useState<Task | null>(null);
  const selectedTask = tareas.find((tarea) => tarea.id === selectedTaskId) ?? null;
  const usuario = getUsuarioActual();
  const tienePendienteEnTarea = (tarea: Task) =>
    tarea.subtareas.some(
      (s) => s.asignado === usuario?.id && (s.estado === "EN_ESPERA" || s.estado === "EN_DESARROLLO")
    );

  const tareasVisibles = tareas.filter((tarea) => tarea.estado !== "EN_ESPERA");

  return (
    <>
      <div className={styles.taskTableContainer}>
        {tareasVisibles.length === 0 ? (
          <div className={styles.noTasks}>No hay tareas en desarrollo</div>
        ) : (
          <table className={styles.taskTable}>
            <thead>
              <tr>
                <th>Asunto</th>
                <th>Campaña</th>
                <th>Tiempo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tareasVisibles.map((tarea) => {
                const conPendiente = tienePendienteEnTarea(tarea);
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
                      : conPendiente
                        ? "4px solid #050505"
                        : undefined;
                return (
                  <tr
                    key={tarea.id}
                    className={rowClass}
                    style={borderLeft ? { borderLeft } : undefined}
                    title={
                      conPendiente
                        ? "Tienes subtareas pendientes en esta tarea"
                        : tarea.estado === "SOLUCIONADO"
                          ? "Tarea solucionada"
                          : undefined
                    }
                  >
                    <td data-label="Asunto" className={styles.taskSubject}>
                      <span>{tarea.asunto}</span>
                      <span style={{ display: "block", fontSize: 10, color: "#6b7280", fontWeight: 400 }}>{tarea.ticket}</span>
                      {conPendiente && (
                        <span style={{ display: "block", fontSize: 11, color: "#92400e", marginTop: 2 }}>Tienes subtareas pendientes por completar</span>
                      )}
                    </td>
                    <td data-label="Campaña">
                      {tarea.subcampana_nombre ? `${tarea.campana_nombre}-${tarea.subcampana_nombre}` : tarea.campana_nombre}
                    </td>
                    <td data-label="Tiempo">
                      <TaskCountdown tareaId={tarea.id} incluyeSabado={tarea.incluye_sabado} />
                    </td>
                    <td data-label="Acciones">
                      <button className={styles.btnDetalles} onClick={() => setSelectedTaskId(tarea.id)}>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <TaskModal
        tarea={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onEmpezarTarea={onEmpezarSubtarea}
        onCompletarSubtarea={onCompletarSubtarea}
        onCambiarEstadoSubtarea={onCambiarEstadoSubtarea}
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
