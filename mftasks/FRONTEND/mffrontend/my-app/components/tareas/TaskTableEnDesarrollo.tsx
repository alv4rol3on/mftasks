"use client";

import { useState } from "react";
import TaskModal from "./TaskModal";
import TaskIniciarModal from "./TaskIniciarModal";
import styles from "./TaskTableEnDesarrollo.module.css";
import { Task } from "@/lib/types";

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
  completandoId?: number | null;
  onIniciar: (
    tarea: Task,
    payload: {
      fecha_inicio: string;
      fecha_entrega_aproximada: string;
      subtareas: { descripcion: string; asignado: number; peso: number }[];
    }
  ) => void;
  onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
}

export default function TaskTableEnDesarrollo({
  tareas,
  accionando,
  completandoId,
  onIniciar,
  onCompletarSubtarea,
}: TaskTableEnDesarrolloProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskParaIniciar, setTaskParaIniciar] = useState<Task | null>(null);

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

          {tareas.map((tarea) => (
            <div className={styles.taskRow} key={tarea.id}>
              <div>{tarea.id}</div>

              <div className={styles.taskSubject}>
                {tarea.asunto}
              </div>

              <div>{tarea.cliente_nombre}</div>

              <div>{tarea.equipo_nombre}</div>

              <div>{tarea.estado}</div>

              <div>{formatearFecha(tarea.fecha_inicio)}</div>

              <div>
                <button
                  className={styles.btnDetalles}
                  onClick={() => setSelectedTask(tarea)}
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
          ))}
        </div>
      </div>

      <TaskModal
        tarea={selectedTask}
        onClose={() => setSelectedTask(null)}
        onCompletarSubtarea={onCompletarSubtarea}
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