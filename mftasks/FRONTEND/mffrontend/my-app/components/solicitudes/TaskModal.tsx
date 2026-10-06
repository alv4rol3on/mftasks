"use client";

import { Fragment, useEffect, useState } from "react";
import styles from "./TaskModalSolicitudes.module.css";
import { Task } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import AdjuntosTarea from "@/components/adjuntos/AdjuntosTarea";

type EventoSeguimiento = {
    id: number;
    tipo_evento: string;
    estado_anterior: string | null;
    estado_nuevo: string | null;
    fecha: string | null;
    detalle: string;
    usuario: string | null;
    subtarea_codigo: string | null;
};

type Props = {
    tarea: Task | null;
    onClose: () => void;
    onAprobar: (tarea: Task) => Promise<void>;
    onRechazar: (tarea: Task, motivo: string) => Promise<void>;
    onReload: () => void;
};

export default function TaskModal({
    tarea,
    onClose,
    onAprobar,
    onRechazar,
    onReload
}: Props) {
    const [seguimiento, setSeguimiento] = useState<EventoSeguimiento[] | null>(null);
    const [rechazando, setRechazando] = useState(false);
    const [motivo, setMotivo] = useState("");
    const [respuesta, setRespuesta] = useState<{
        tipo: "aprobada" | "rechazada";
        ticket: string | null;
        asunto: string;
        motivo?: string;
    } | null>(null);


    const tareaId = tarea?.id ?? null;

    useEffect(() => {
        if (!tareaId) {
            setSeguimiento(null);
            return;
        }

        let cancel = false;
        setSeguimiento(null);

        apiFetch<EventoSeguimiento[]>(`/api/tasks/tasks/${tareaId}/logs/`)
            .then((data) => {
                if (!cancel) setSeguimiento(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancel) setSeguimiento([]);
            });

        return () => {
            cancel = true;
        };
    }, [tareaId]);

    if (!tarea) return null;

    const puedeOperar =
        Boolean(tarea.puedo_aprobar) && tarea.estado === "EN_ESPERA";

    const NOMBRES: Record<string, string> = {
        APROBADORES: "Aprobadores del equipo",
        LIDER: "Revisión del líder",
        COMPLETADO: "Completado",
    };
    const nombreNivel = (n?: string | null) => (n ? NOMBRES[n] ?? n : "");

    const ORDEN = ["APROBADORES", "LIDER", "COMPLETADO"];

    const estadoPaso = (
        paso: string
    ): "aprobado" | "rechazado" | "actual" | "pendiente" | "omitido" => {
        const registro = (tarea.aprobaciones ?? []).find((a) => a.nivel === paso);
        if (registro) {
            return registro.accion === "APROBADO" ? "aprobado" : "rechazado";
        }
        if (tarea.auto_aprobada && paso === "APROBADORES") return "omitido";
        if (tarea.estado === "RECHAZADO") return "omitido";
        if (tarea.paso_aprobacion === paso) return "actual";
        if (tarea.paso_aprobacion === "COMPLETADO") return "aprobado";
        if (
            ORDEN.indexOf(tarea.paso_aprobacion ?? "") > ORDEN.indexOf(paso)
        ) {
            return "aprobado";
        }
        return "pendiente";
    };

    const colores: Record<string, { bg: string; fg: string }> = {
        aprobado: { bg: "#dcfce7", fg: "#166534" },
        rechazado: { bg: "#fee2e2", fg: "#991b1b" },
        actual: { bg: "#fef3c7", fg: "#92400e" },
        pendiente: { bg: "#f3f4f6", fg: "#6b7280" },
        omitido: { bg: "#f3f4f6", fg: "#9ca3af" },
    };

    const etiquetas: Record<string, string> = {
        aprobado: "Aprobado",
        rechazado: "Rechazado",
        actual: "Pendiente",
        pendiente: "Pendiente",
        omitido: "—",
    };

    const cerrar = () => {
        onClose();
    };

    {/*const confirmarRechazo = async () => {
        if (!motivo.trim()) return;
        try {
            await onRechazar(tarea, motivo.trim());
        } catch {
            return;
        }
        setRechazando(false);
        setMotivo("");
    };*/}

    const aprobar = async () => {
        try {
            await onAprobar(tarea);

            setRespuesta({
                tipo: "aprobada",
                ticket: tarea.ticket ?? null,
                asunto: tarea.asunto,
            });
        } catch {
            // El padre maneja el error
        }
    };

    const confirmarRechazo = async () => {
        if (!motivo.trim()) return;

        try {
            await onRechazar(tarea, motivo.trim());

            setRespuesta({
                tipo: "rechazada",
                ticket: tarea.ticket ?? null,
                asunto: tarea.asunto,
                motivo: motivo.trim(),
            });

            setRechazando(false);
            setMotivo("");
        } catch {
            // El padre maneja el error
        }
    };

    if (respuesta) {
        return (
            <div className={styles.overlay}>
                <div className={styles.card}>

                    <div className={styles.circle}>
                        {respuesta.tipo === "aprobada" ? (
                            <svg
                                className={styles.check}
                                viewBox="0 0 52 52"
                                aria-hidden="true"
                            >
                                <path d="M14 27 L23 36 L38 18" />
                            </svg>
                        ) : (
                            <svg
                                className={styles.rejected}
                                viewBox="0 0 52 52"
                                aria-hidden="true"
                            >
                                <path d="M16 16 L36 36 M36 16 L16 36" />
                            </svg>
                        )}
                    </div>

                    <h2 className={styles.title}>
                        {respuesta.tipo === "aprobada"
                            ? "¡Solicitud aprobada!"
                            : "¡Solicitud rechazada!"}
                    </h2>

                    {respuesta.ticket && (
                        <p className={styles.ticket}>
                            N.º {respuesta.ticket}
                        </p>
                    )}

                    <p className={styles.asunto}>
                        {respuesta.asunto}
                    </p>

                    {respuesta.tipo === "rechazada" && respuesta.motivo && (
                        <p className={styles.motivoRespuesta}>
                            Motivo: {respuesta.motivo}
                        </p>
                    )}

                    <button
                        type="button"
                        className={styles.button}
                        onClick={() => {
                            setRespuesta(null);
                            onClose();
                            onReload();
                        }}
                    >
                        Aceptar
                    </button>

                </div>
            </div>
        );
    }

    return (
        <div className={styles.modalOverlay} onClick={cerrar}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabecera */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2>Solicitud #{tarea.ticket}</h2>
                        <p>{tarea.asunto}</p>
                    </div>

                    <button
                        className={styles.close}
                        onClick={cerrar}
                    >
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
                                    <td>
                                        <strong>Solicitante</strong>
                                    </td>
                                    <td>{tarea.solicitante_nombre}</td>
                                </tr>

                                <tr>
                                    <td>
                                        <strong>Campaña</strong>
                                    </td>
                                    <td>{tarea.cliente_nombre}</td>
                                </tr>

                                <tr>
                                    <td>
                                        <strong>Equipo</strong>
                                    </td>
                                    <td>{tarea.equipo_nombre}</td>
                                </tr>

                                <tr>
                                    <td>
                                        <strong>Estado</strong>
                                    </td>
                                    <td>{tarea.estado}</td>
                                </tr>

                                <tr>
                                    <td>
                                        <strong>Fecha de solicitud</strong>
                                    </td>
                                    <td>
                                        {new Date(
                                            tarea.fecha_creacion
                                        ).toLocaleString("es-PE", {
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

                    {/* Flujo de aprobación */}
                    <div style={{ gridColumn: "1 / -1" }}>
                        <h3>Flujo de aprobación</h3>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                            }}
                        >
                            {["APROBADORES", "LIDER"].map((paso, idx) => {
                                const est = estadoPaso(paso);
                                return (
                                    <Fragment key={paso}>
                                        {idx > 0 && (
                                            <div style={{ fontSize: 20, fontWeight: 700, color: "#6b7280" }}>
                                                →
                                            </div>
                                        )}
                                        <div
                                            style={{
                                                background: colores[est].bg,
                                                color: colores[est].fg,
                                                borderRadius: 8,
                                                padding: "10px 14px",
                                                fontSize: 12,
                                                minWidth: 160,
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                                {nombreNivel(paso)}
                                            </div>
                                            <div>{etiquetas[est]}</div>
                                        </div>
                                    </Fragment>
                                );
                            })}
                        </div>

                        {(tarea.aprobaciones ?? []).length > 0 && (
                            <ul
                                style={{
                                    marginTop: 10,
                                    paddingLeft: 18,
                                    fontSize: 12,
                                    color: "#374151",
                                }}
                            >
                                {(tarea.aprobaciones ?? []).map((a) => (
                                    <li key={a.id}>
                                        <strong>{nombreNivel(a.nivel)}</strong>:{" "}
                                        {a.accion === "APROBADO" ? "Aprobó" : "Rechazó"} —{" "}
                                        {a.usuario_nombre ?? "—"}
                                        {a.motivo ? ` (${a.motivo})` : ""}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {/* OPCIONES */}
                        {puedeOperar && (
                            <div className={styles.modalFooter}>
                                {rechazando ? (
                                    <>
                                        <textarea
                                            placeholder="Motivo del rechazo (obligatorio)"
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            rows={3}
                                            style={{
                                                flex: 1,
                                                padding: "8px",
                                                borderRadius: "6px",
                                                border: "1px solid #ccc",
                                            }}
                                        />
                                        <button
                                            className={`${styles.btn} ${styles.btnNo}`}
                                            onClick={confirmarRechazo}
                                            disabled={!motivo.trim()}
                                        >
                                            Enviar respuesta
                                        </button>
                                        <button
                                            className={`${styles.btn} ${styles.btnSecondary}`}
                                            onClick={() => {
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
                                            onClick={aprobar}
                                        >
                                            Aprobar
                                        </button>
                                        <button
                                            className={`${styles.btn} ${styles.btnNo}`}
                                            onClick={() => setRechazando(true)}
                                        >
                                            Rechazar solicitud
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Adjuntos */}
                    <div style={{ gridColumn: "1 / -1" }}>
                        <AdjuntosTarea
                            archivos={tarea.archivos}
                            tareaId={tarea.id}
                            ticket={tarea.ticket}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}

