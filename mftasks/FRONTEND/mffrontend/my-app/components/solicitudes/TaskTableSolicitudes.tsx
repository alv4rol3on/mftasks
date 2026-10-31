"use client";

import { useMemo, useState } from "react";
import TaskModal from "./TaskModal";
import IconButton from "@/components/ui/IconButton";
import PrioridadBadge, { PRIORIDAD_ORDEN } from "@/components/tareas/PrioridadBadge";
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
  onAprobar: (tarea: Task) => Promise<void>;
  onRechazar: (tarea: Task, motivo: string) => Promise<void>;
  onReload: () => void;
}

export default function TaskTableSolicitudes({
  tareas,
  onAprobar,
  onRechazar,
  onReload
}: TaskTableSolicitudesProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const ordenadas = useMemo(
    () =>
      [...tareas].sort((a, b) => {
        const pa = PRIORIDAD_ORDEN[String(a.prioridad ?? "MEDIA")] ?? 0;
        const pb = PRIORIDAD_ORDEN[String(b.prioridad ?? "MEDIA")] ?? 0;
        if (pa !== pb) return pb - pa;
        return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
      }),
    [tareas]
  );

  const handleAprobar = async (tarea: Task) => {
    await onAprobar(tarea);
  };

  const handleRechazar = async (tarea: Task, motivo: string) => {
    await onRechazar(tarea, motivo);
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
              <div>Fecha de solicitud</div>
              <div>Asunto</div>
              <div>Cliente</div>
              <div>Equipo</div>
              <div>Acciones</div>
            </div>

            {ordenadas.map((tarea) => (
              <div className={styles.taskRow} key={tarea.id}>
                <div>{formatearFecha(tarea.fecha_creacion)}</div>

                <div className={styles.taskSubject}>
                  <span>{tarea.subcampana_nombre} - {tarea.asunto}</span>
                  <PrioridadBadge prioridad={tarea.prioridad} compact />
                </div>

                <div>{tarea.cliente_nombre}</div>

                <div>{tarea.equipo_nombre}</div>


                <div>
                  <IconButton
                    icon="eye"
                    variant="info"
                    title="Ver detalles"
                    onClick={() => setSelectedTask(tarea)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskModal
        tarea={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAprobar={handleAprobar}
        onRechazar={handleRechazar}
        onReload={onReload}
      />
    </>
  );
}
