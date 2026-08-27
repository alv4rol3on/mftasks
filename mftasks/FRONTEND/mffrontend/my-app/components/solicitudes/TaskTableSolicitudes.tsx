"use client";

import { useState } from "react";
import TaskModal from "./TaskModal";
import styles from "./TasksTableSolicitudes.module.css";
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

interface TaskTableSolicitudesProps {
  tareas: Task[];
  accionando?: number | null;
  onAprobar: (tarea: Task) => Promise<void>;
  onRechazar: (tarea: Task, motivo: string) => Promise<void>;
}

export default function TaskTableSolicitudes({
  tareas,
  accionando,
  onAprobar,
  onRechazar,
}: TaskTableSolicitudesProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleAprobar = async (tarea: Task) => {
    await onAprobar(tarea);
    setSelectedTask(null);
  };

  const handleRechazar = async (tarea: Task, motivo: string) => {
    await onRechazar(tarea, motivo);
    setSelectedTask(null);
  };

  return (
    <>
      <div className={styles.taskTableContainer}>
        {tareas.length === 0 ? (
          <div className={styles.noTasks}>
            Por el momento no hay solicitudes pendientes para su revisión
          </div>
        ) : (
          <div className={styles.taskTable}>
            <div className={styles.taskHeader}>
              <div>ID</div>
              <div>Asunto</div>
              <div>Cliente</div>
              <div>Equipo</div>
              <div>Fecha de solicitud</div>
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

                <div>{formatearFecha(tarea.fecha_creacion)}</div>

                <div>
                  <button
                    className={styles.btnDetalles}
                    onClick={() => setSelectedTask(tarea)}
                  >
                    Ver detalles
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskModal
        tarea={selectedTask}
        onClose={() => setSelectedTask(null)}
        accionando={accionando}
        onAprobar={handleAprobar}
        onRechazar={handleRechazar}
      />
    </>
  );
}