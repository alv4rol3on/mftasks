"use client";

import styles from "./TaskModalDesarrollo.module.css";
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

type Props = {
    tarea: Task | null;
    onClose: () => void;
};

export default function TaskModal({ tarea, onClose }: Props) {
    if (!tarea) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <div>
                        <h2>Tarea #{tarea.id}</h2>
                        <p>{tarea.asunto}</p>
                    </div>

                    <button className={styles.close} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.modalColumn}>
                        <h3>Información</h3>

                        <table className={styles.infoTable}>
                            <tbody>
                                <tr>
                                    <td><strong>Cliente</strong></td>
                                    <td>{tarea.cliente_nombre}</td>
                                </tr>

                                <tr>
                                    <td><strong>Equipo</strong></td>
                                    <td>{tarea.equipo_nombre}</td>
                                </tr>

                                <tr>
                                    <td><strong>Estado</strong></td>
                                    <td>{tarea.estado}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de solicitud</strong></td>
                                    <td>{formatearFecha(tarea.fecha_creacion)}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de inicio</strong></td>
                                    <td>{formatearFecha(tarea.fecha_inicio)}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de entrega aproximada</strong></td>
                                    <td>{formatearFecha(tarea.fecha_entrega_aproximada)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.modalColumn}>
                        <h3>Descripción</h3>

                        <div className={styles.descriptionBox}>
                            {tarea.descripcion}
                        </div>

                        <h3>Subtareas</h3>

                        {tarea.subtareas.length === 0 ? (
                            <p className={styles.sinSubtareas}>
                                Esta tarea aún no tiene subtareas asignadas.
                            </p>
                        ) : (
                            <table className={styles.subtareasTable}>
                                <thead>
                                    <tr>
                                        <th>Descripción</th>
                                        <th>Asignado</th>
                                        <th>Estado</th>
                                        <th>Peso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tarea.subtareas.map((subtarea) => (
                                        <tr key={subtarea.id}>
                                            <td>{subtarea.descripcion}</td>
                                            <td>{subtarea.asignado_nombre}</td>
                                            <td>{subtarea.estado}</td>
                                            <td>{subtarea.peso}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}