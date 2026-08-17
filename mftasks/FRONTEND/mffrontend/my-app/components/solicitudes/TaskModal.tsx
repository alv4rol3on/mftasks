"use client";

import styles from "./TaskModalSolicitudes.module.css";

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
                {/* Cabecera */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2>Solicitud #{tarea.id}</h2>
                        <p>{tarea.asunto}</p>
                    </div>

                    <button className={styles.close} onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Cuerpo */}
                <div className={styles.modalBody}>
                    <div className={styles.modalColumn}>
                        <h3>Información</h3>

                        <table className={styles.infoTable}>
                            <tbody>
                                <tr>
                                    <td><strong>Cliente</strong></td>
                                    <td>{tarea.cliente}</td>
                                </tr>

                                <tr>
                                    <td><strong>Estado</strong></td>
                                    <td>{tarea.estado}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de Solicitud</strong></td>
                                    <td>
                                        {new Date(tarea.fecha_solicitud).toLocaleString("es-PE", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </td>
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
                </div>

                {/* Pie */}
                <div className={styles.modalFooter}>
                    <button className={styles.btnYes}>
                        Comenzar asignaciones
                    </button>
                    <button className={styles.btnNo}>
                        Rechazar solicitud
                    </button>
                </div>
            </div>
        </div>
    );
}