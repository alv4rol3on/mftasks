"use client";

import styles from "./TaskModalDesarrollo.module.css";
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

type Props = {
    tarea: Task | null;
    onClose: () => void;
    onEmpezarTarea?: (tareaId: number, subtareaId: number) => void;
    onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
    empezandoId?: number | null;
    completandoId?: number | null;
};

export default function TaskModal({ tarea, onClose, onEmpezarTarea, onCompletarSubtarea, empezandoId, completandoId }: Props) {
    if (!tarea) return null;
    const usuario = getUsuarioActual();

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
                    </div>

                    <div className={styles.progresoSection}>
                        <h3>Progreso</h3>

                        {tarea.subtareas.length === 0 ? (
                            <p className={styles.sinSubtareas}>
                                Esta tarea ha sido aprobada y se encuentra en proceso de asignación
                            </p>
                        ) : (
                            <div className={styles.subtareasContainer}>
                                <table className={styles.subtareasTable}>
                                    <thead>
                                        <tr>
                                            <th>Descripción</th>
                                            <th>Asignado</th>
                                            <th>Estado</th>
                                            <th>Peso</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {tarea.subtareas.map((subtarea) => {
                                            const esMiSubtarea = usuario?.id === subtarea.asignado;
                                            const puedeEmpezar = esMiSubtarea && subtarea.estado === "EN_ESPERA" && !!onEmpezarTarea;
                                            const puedeCompletar = esMiSubtarea && subtarea.estado === "EN_DESARROLLO" && !!onCompletarSubtarea;
                                            return (
                                                <tr
                                                    key={subtarea.id}
                                                    className={
                                                        subtarea.estado === "EN_ESPERA"
                                                            ? styles.estadoEnEspera
                                                            : subtarea.estado === "EN_DESARROLLO"
                                                                ? styles.estadoEnDesarrollo
                                                                : subtarea.estado === "SOLUCIONADO"
                                                                    ? styles.estadoSolucionado
                                                                    : ""
                                                    }
                                                >
                                                    <td>{subtarea.descripcion}</td>
                                                    <td>{subtarea.asignado_nombre}</td>
                                                    <td>{subtarea.estado}</td>
                                                    <td>{subtarea.peso}</td>
                                                    <td>
                                                        {puedeEmpezar ? (
                                                            <button
                                                                onClick={() =>
                                                                    onEmpezarTarea!(tarea.id, subtarea.id)
                                                                }
                                                                disabled={empezandoId === subtarea.id}
                                                                style={{
                                                                    background: "#0891b2",
                                                                    color: "white",
                                                                    border: "none",
                                                                    padding: "4px 10px",
                                                                    borderRadius: 6,
                                                                    cursor: "pointer",
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                {empezandoId === subtarea.id
                                                                    ? "Iniciando…"
                                                                    : "Empezar"}
                                                            </button>
                                                        ) : puedeCompletar ? (
                                                            <button
                                                                onClick={() =>
                                                                    onCompletarSubtarea!(tarea.id, subtarea.id)
                                                                }
                                                                disabled={completandoId === subtarea.id}
                                                                style={{
                                                                    background: "#16a34a",
                                                                    color: "white",
                                                                    border: "none",
                                                                    padding: "4px 10px",
                                                                    borderRadius: 6,
                                                                    cursor: "pointer",
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                {completandoId === subtarea.id
                                                                    ? "Guardando…"
                                                                    : "Marcar como completado"}
                                                            </button>
                                                        ) : subtarea.estado === "SOLUCIONADO" ? (
                                                            <span style={{ color: "#FFFFFF", fontSize: 12 }}>
                                                                ✓ Terminada
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}