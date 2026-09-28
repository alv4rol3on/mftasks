"use client";

import { useEffect, useState } from "react";
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
    const [seguimiento, setSeguimiento] = useState<EventoSeguimiento[] | null>(null);

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

    const puedeOperar = Boolean(tarea.puedo_aprobar) && tarea.estado === "EN_ESPERA";

    const ocupado = accionando === tarea.id;

    const CADENA = ["GERENTE", "SUBGERENTE", "COORDINADOR", "LIDER"];

    const nombreNivelLocal = (nivel?: string | null): string => {
        const nombres: Record<string, string> = {
            GERENTE: "Gerente",
            SUBGERENTE: "Subgerente",
            COORDINADOR: "Coordinador",
            LIDER: "Líder",
            COMPLETADO: "Completado",
        };
        return nivel ? nombres[nivel] ?? nivel : "";
    };

    const estadoNivel = (nivel: string, indice: number): "aprobado" | "rechazado" | "actual" | "pendiente" | "omitido" => {
        const registro = (tarea.aprobaciones ?? []).find((a) => a.nivel === nivel);
        if (registro) return registro.accion === "APROBADO" ? "aprobado" : "rechazado";
        if (tarea.estado === "RECHAZADO") return "omitido";
        if (tarea.paso_aprobacion === "COMPLETADO") return "aprobado";
        if (tarea.paso_aprobacion === nivel) return "actual";
        const actual = CADENA.indexOf(tarea.paso_aprobacion ?? "");
        if (actual === -1) return "pendiente";
        return indice < actual ? "aprobado" : "pendiente";
    };

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
                                    <td><strong>Solicitante</strong></td>
                                    <td>{tarea.solicitante_nombre}</td>
                                </tr>
                                <tr>
                                    <td><strong>Campaña</strong></td>
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

                    <div style={{ gridColumn: "1 / -1" }}>
                        <h3>Flujo de aprobación</h3>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {CADENA.map((nivel, indice) => {
                                const estado = estadoNivel(nivel, indice);
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
                                const color = colores[estado];
                                return (
                                    <div
                                        key={nivel}
                                        style={{
                                            background: color.bg,
                                            color: color.fg,
                                            borderRadius: 8,
                                            padding: "8px 12px",
                                            fontSize: 12,
                                            minWidth: 120,
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{nombreNivelLocal(nivel)}</div>
                                        <div>{etiquetas[estado]}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {(tarea.aprobaciones ?? []).length > 0 && (
                            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12, color: "#374151" }}>
                                {(tarea.aprobaciones ?? []).map((a) => (
                                    <li key={a.id}>
                                        <strong>{nombreNivelLocal(a.nivel)}</strong>:{" "}
                                        {a.accion === "APROBADO" ? "Aprobó" : "Rechazó"} —{" "}
                                        {a.usuario_nombre ?? "—"}
                                        {a.motivo ? ` (${a.motivo})` : ""}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                        <h3>Seguimiento</h3>
                        {seguimiento === null ? (
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Cargando historial…</div>
                        ) : seguimiento.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Sin eventos registrados.</div>
                        ) : (
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#374151" }}>
                                {seguimiento.map((ev) => (
                                    <li key={ev.id} style={{ marginBottom: 4 }}>
                                        <span style={{ color: "#6b7280" }}>
                                            {ev.fecha ? new Date(ev.fecha).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                                        </span>{" "}
                                        <strong>{ev.tipo_evento}</strong>
                                        {ev.estado_nuevo ? ` → ${ev.estado_nuevo}` : ""}
                                        {ev.subtarea_codigo ? ` (${ev.subtarea_codigo})` : ""}
                                        {ev.usuario ? ` · ${ev.usuario}` : ""}
                                        {ev.detalle ? ` — ${ev.detalle}` : ""}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                        <AdjuntosTarea archivos={tarea.archivos} tareaId={tarea.id} ticket={tarea.ticket} />
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