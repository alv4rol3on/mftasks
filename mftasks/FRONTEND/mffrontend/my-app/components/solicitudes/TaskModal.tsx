"use client";

import { Fragment, useEffect, useState } from "react";
import styles from "./TaskModalSolicitudes.module.css";
import { Task } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import AdjuntosTarea from "@/components/adjuntos/AdjuntosTarea";
import RichTextView from "@/components/shared/RichTextView";
import ReaperturaAprobarModal, {
    type AprobarReaperturaPayload,
} from "./ReaperturaAprobarModal";

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
    onAprobarReapertura: (tarea: Task, payload: AprobarReaperturaPayload) => Promise<void>;
    onRechazarReapertura: (tarea: Task, motivo: string) => Promise<void>;
    onReload: () => void;
};

export default function TaskModal({
    tarea,
    onClose,
    onAprobar,
    onRechazar,
    onAprobarReapertura,
    onRechazarReapertura,
    onReload
}: Props) {
    const [seguimiento, setSeguimiento] = useState<EventoSeguimiento[] | null>(null);
    const [rechazando, setRechazando] = useState(false);
    const [motivo, setMotivo] = useState("");
    const [aprobandoReapertura, setAprobandoReapertura] = useState(false);
    const [respuesta, setRespuesta] = useState<{
        tipo: "aprobada" | "rechazada";
        ticket: string | null;
        asunto: string;
        motivo?: string;
        reapertura?: boolean;
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

    const esReapertura = tarea.estado === "REAPERTURA_PENDIENTE";
    const puedeOperar =
        Boolean(tarea.puedo_aprobar) && tarea.estado === "EN_ESPERA";
    const puedeResolverReapertura =
        esReapertura && Boolean(tarea.puedo_resolver_reapertura);

    const NOMBRES: Record<string, string> = {
        APROBADORES: "Aprobación de superiores",
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
        aprobado: { bg: "color-mix(in srgb, var(--color-done) 12%, var(--color-background))", fg: "var(--color-done)" },
        rechazado: { bg: "color-mix(in srgb, var(--color-danger) 10%, var(--color-background))", fg: "var(--color-danger)" },
        actual: { bg: "color-mix(in srgb, var(--color-waiting) 12%, var(--color-background))", fg: "var(--color-waiting)" },
        pendiente: { bg: "var(--color-surface)", fg: "var(--color-text-secondary)" },
        omitido: { bg: "var(--color-surface)", fg: "var(--color-text-secondary)" },
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
            if (esReapertura) {
                setAprobandoReapertura(true);
                return;
            }

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

    const confirmarAprobarReapertura = async (
        payload: AprobarReaperturaPayload
    ) => {
        await onAprobarReapertura(tarea, payload);
        setAprobandoReapertura(false);
        setRespuesta({
            tipo: "aprobada",
            ticket: tarea.ticket ?? null,
            asunto: tarea.asunto,
            reapertura: true,
        });
    };

    const confirmarRechazo = async () => {
        if (!motivo.trim()) return;

        try {
            if (esReapertura) {
                await onRechazarReapertura(tarea, motivo.trim());
            } else {
                await onRechazar(tarea, motivo.trim());
            }

            setRespuesta({
                tipo: "rechazada",
                ticket: tarea.ticket ?? null,
                asunto: tarea.asunto,
                motivo: motivo.trim(),
                reapertura: esReapertura,
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
                            ? respuesta.reapertura
                                ? "¡Reapertura aprobada!"
                                : "¡Solicitud aprobada!"
                            : respuesta.reapertura
                                ? "¡Reapertura rechazada!"
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
        <>
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

                        <RichTextView
                            html={tarea.descripcion}
                            className={styles.descriptionBox}
                        />
                    </div>

                    {esReapertura && (
                        <div style={{ gridColumn: "1 / -1" }}>
                            <h3>Solicitud de reapertura</h3>
                            <div className={styles.descriptionBox}>
                                <strong>Motivo del cliente:</strong>
                                <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
                                    {tarea.motivo_reapertura || "Sin motivo registrado."}
                                </p>
                                {(tarea.subtareas ?? []).length > 0 && (
                                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
                                        Subtareas anteriores:{" "}
                                        {(tarea.subtareas ?? []).length}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

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
                                            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-secondary)" }}>
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
                                    color: "var(--color-text)",
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
                        {(puedeOperar || puedeResolverReapertura) && (
                            <div className={styles.modalFooter}>
                                {rechazando ? (
                                    <>
                                        <textarea
                                            placeholder={
                                                esReapertura
                                                    ? "Motivo del rechazo de la reapertura (obligatorio)"
                                                    : "Motivo del rechazo (obligatorio)"
                                            }
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
                                            {esReapertura
                                                ? "Aprobar reapertura"
                                                : "Aprobar"}
                                        </button>
                                        <button
                                            className={`${styles.btn} ${styles.btnNo}`}
                                            onClick={() => setRechazando(true)}
                                        >
                                            {esReapertura
                                                ? "Rechazar reapertura"
                                                : "Rechazar solicitud"}
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

        {aprobandoReapertura && (
            <ReaperturaAprobarModal
                tarea={tarea}
                onClose={() => setAprobandoReapertura(false)}
                onSaved={confirmarAprobarReapertura}
            />
        )}
        </>
    );
}

