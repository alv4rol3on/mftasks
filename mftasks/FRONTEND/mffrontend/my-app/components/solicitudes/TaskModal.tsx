"use client";

import { useState } from "react";
import styles from "./TaskModalSolicitudes.module.css";
import { Task } from "@/lib/types";

type Props = {
    tarea: Task | null;
    onClose: () => void;
    accionando?: number | null;
    onAprobar: (tarea: Task) => Promise<void>;
    onRechazar: (tarea: Task, motivo: string) => Promise<void>;
};

export default function TaskModal({
    tarea,
    onClose,
    accionando,
    onAprobar,
    onRechazar,
}: Props) {
    const [rechazando, setRechazando] = useState(false);
    const [motivo, setMotivo] = useState("");

    if (!tarea) return null;

    const puedeOperar = tarea.puedo_operar && tarea.estado === "EN_ESPERA";

    const ocupado = accionando === tarea.id;

    const cerrar = () => {
        if (ocupado) return;
        setRechazando(false);
        setMotivo("");
        onClose();
    };

    const confirmarRechazo = async () => {
        if (!motivo.trim() || ocupado) return;
        try {
            await onRechazar(tarea, motivo.trim());
        } catch {
            return;
        }
        setRechazando(false);
        setMotivo("");
    };

    return (
        <div className={styles.modalOverlay} onClick={cerrar}>
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

                    <button className={styles.close} onClick={cerrar} disabled={ocupado} style={ocupado ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
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
                                    <td>
                                        {new Date(tarea.fecha_creacion).toLocaleString("es-PE", {
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
                {puedeOperar && (
                    <div className={styles.modalFooter}>
                        {rechazando ? (
                            <>
                                <textarea
                                    placeholder="Motivo del rechazo (obligatorio)"
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    rows={3}
                                    disabled={ocupado}
                                    style={{
                                        flex: 1,
                                        padding: "8px",
                                        borderRadius: "6px",
                                        border: "1px solid #ccc",
                                        opacity: ocupado ? 0.6 : 1,
                                    }}
                                />

                                <button
                                    className={`${styles.btn} ${styles.btnNo}`}
                                    onClick={confirmarRechazo}
                                    disabled={ocupado || !motivo.trim()}
                                    style={ocupado ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                                >
                                    {ocupado ? "Procesando…" : "Confirmar rechazo"}
                                </button>

                                <button
                                    className={`${styles.btn} ${styles.btnSecondary}`}
                                    disabled={ocupado}
                                    style={ocupado ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                                    onClick={() => {
                                        if (ocupado) return;
                                        setRechazando(false);
                                        setMotivo("");
                                    }}
                                >
                                    Cancelar
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className={`${styles.btn} ${styles.btnYes}`}
                                    onClick={async () => {
                                        try { await onAprobar(tarea); } catch {}
                                    }}
                                    disabled={ocupado}
                                    style={ocupado ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                                >
                                    {ocupado ? "Procesando…" : "Aprobar"}
                                </button>

                                <button
                                    className={`${styles.btn} ${styles.btnNo}`}
                                    onClick={() => setRechazando(true)}
                                    disabled={ocupado}
                                    style={ocupado ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                                >
                                    Rechazar solicitud
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}