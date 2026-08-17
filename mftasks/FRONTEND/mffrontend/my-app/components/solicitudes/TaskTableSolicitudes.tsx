"use client";

import { useState } from "react";
import TaskModal from "./TaskModal";
import styles from "./TasksTableSolicitudes.module.css"

type Task = {
  id: number;
  asunto: string;
  descripcion: string;
  cliente: string;
  estado: string;
  fecha_solicitud: string;
  fecha_inicio: string;
  fecha_fin_aproximada: string;
};

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

  if (isNaN(date.getTime())) {
    console.error("Fecha inválida:", fecha);
    return "-";
  }

  return formatter.format(date);
};

export default function TaskTableSolicitudes({
  tareas,
}: {
  tareas: Task[];
}) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <>
      <div className={styles.taskTableContainer}>
        <div className={styles.taskTable}>

          <div className={styles.taskHeader}>
            <div>ID</div>
            <div>Asunto</div>
            <div>Cliente</div>
            <div>Fecha de solicitud</div>
            <div>Acciones</div>
          </div>

          {tareas.map((tarea) => (
            <div className={styles.taskRow} key={tarea.id}>
              <div>{tarea.id}</div>

              <div className={styles.taskSubject}>
                {tarea.asunto}
              </div>

              <div>{tarea.cliente}</div>

              <div>{formatearFecha(tarea.fecha_solicitud)}</div>

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
      </div>

      <TaskModal
        tarea={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}