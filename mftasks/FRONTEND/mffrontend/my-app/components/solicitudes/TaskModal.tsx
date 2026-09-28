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

    const puedeOperar =
        Boolean(tarea.puedo_aprobar) &&
        tarea.estado === "EN_ESPERA";

    const ocupado = accionando === tarea.id;

    // Los tres primeros niveles son alternativas.
    // Cualquiera de ellos que apruebe pasa directamente al LÍDER.
    const NIVELES_GLOBALES = [
        "GERENTE",
        "SUBGERENTE",
        "SUPERVISOR",
    ];

    const PASO_FINAL = "LIDER";

    const nombreNivelLocal = (nivel?: string | null): string => {
        const nombres: Record<string, string> = {
            GERENTE: "Gerente",
            SUBGERENTE: "Subgerente",
            SUPERVISOR: "Supervisor",
            LIDER: "Líder",
            COMPLETADO: "Completado",
        };

        return nivel ? nombres[nivel] ?? nivel : "";
    };

    /**
     * Determina el estado visual del bloque de aprobación global.
     *
     * Regla:
     * - Si alguno de GERENTE/SUBGERENTE/SUPERVISOR aprobó:
     *   el bloque global está aprobado.
     * - Si ninguno aprobó y el paso actual es uno de ellos:
     *   está pendiente.
     * - Si el paso actual es LIDER:
     *   el bloque global ya fue superado.
     * - Si la tarea fue rechazada:
     *   se muestra como omitido.
     */
    const estadoNivelGlobal = (): "aprobado" | "rechazado" | "actual" | "pendiente" | "omitido" => {
        const aprobacionGlobal = (tarea.aprobaciones ?? []).find(
            (a) =>
                NIVELES_GLOBALES.includes(a.nivel) &&
                a.accion === "APROBADO"
        );

        const rechazoGlobal = (tarea.aprobaciones ?? []).find(
            (a) =>
                NIVELES_GLOBALES.includes(a.nivel) &&
                a.accion !== "APROBADO"
        );

        if (aprobacionGlobal) {
            return "aprobado";
        }

        if (rechazoGlobal) {
            return "rechazado";
        }

        if (tarea.estado === "RECHAZADO") {
            return "omitido";
        }

        if (
            tarea.paso_aprobacion === "GERENTE" ||
            tarea.paso_aprobacion === "SUBGERENTE" ||
            tarea.paso_aprobacion === "SUPERVISOR"
        ) {
            return "actual";
        }

        if (
            tarea.paso_aprobacion === PASO_FINAL ||
            tarea.paso_aprobacion === "COMPLETADO"
        ) {
            return "aprobado";
        }

        return "pendiente";
    };

    /**
     * Estado del LÍDER.
     */
    const estadoLider = (): "aprobado" | "rechazado" | "actual" | "pendiente" | "omitido" => {
        const registro = (tarea.aprobaciones ?? []).find(
            (a) => a.nivel === PASO_FINAL
        );

        if (registro) {
            return registro.accion === "APROBADO"
                ? "aprobado"
                : "rechazado";
        }

        if (tarea.estado === "RECHAZADO") {
            return "omitido";
        }

        if (tarea.paso_aprobacion === "COMPLETADO") {
            return "aprobado";
        }

        if (tarea.paso_aprobacion === PASO_FINAL) {
            return "actual";
        }

        return "pendiente";
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

    const estadoGlobal = estadoNivelGlobal();
    const estadoFinal = estadoLider();

    const colores: Record<
        string,
        { bg: string; fg: string }
    > = {
        aprobado: {
            bg: "#dcfce7",
            fg: "#166534",
        },
        rechazado: {
            bg: "#fee2e2",
            fg: "#991b1b",
        },
        actual: {
            bg: "#fef3c7",
            fg: "#92400e",
        },
        pendiente: {
            bg: "#f3f4f6",
            fg: "#6b7280",
        },
        omitido: {
            bg: "#f3f4f6",
            fg: "#9ca3af",
        },
    };

    const etiquetas: Record<string, string> = {
        aprobado: "Aprobado",
        rechazado: "Rechazado",
        actual: "Pendiente",
        pendiente: "Pendiente",
        omitido: "—",
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

                    <button
                        className={styles.close}
                        onClick={cerrar}
                        disabled={ocupado}
                        style={
                            ocupado
                                ? {
                                      opacity: 0.5,
                                      cursor: "not-allowed",
                                  }
                                : undefined
                        }
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
                            {/* APROBACIÓN GLOBAL */}
                            <div
                                style={{
                                    background: colores[estadoGlobal].bg,
                                    color: colores[estadoGlobal].fg,
                                    borderRadius: 8,
                                    padding: "10px 14px",
                                    fontSize: 12,
                                    minWidth: 230,
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 700,
                                        marginBottom: 4,
                                    }}
                                >
                                    Aprobación global
                                </div>

                                <div>
                                    {etiquetas[estadoGlobal]}
                                </div>

                                <div
                                    style={{
                                        marginTop: 6,
                                        fontSize: 11,
                                        opacity: 0.8,
                                    }}
                                >
                                    Gerente / Subgerente / Supervisor
                                </div>
                            </div>

                            {/* FLECHA */}
                            <div
                                style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: "#6b7280",
                                }}
                            >
                                →
                            </div>

                            {/* LÍDER */}
                            <div
                                style={{
                                    background: colores[estadoFinal].bg,
                                    color: colores[estadoFinal].fg,
                                    borderRadius: 8,
                                    padding: "10px 14px",
                                    fontSize: 12,
                                    minWidth: 140,
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 700,
                                        marginBottom: 4,
                                    }}
                                >
                                    {nombreNivelLocal(PASO_FINAL)}
                                </div>

                                <div>
                                    {etiquetas[estadoFinal]}
                                </div>
                            </div>
                        </div>

                        {/* Historial */}
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
                                        <strong>
                                            {nombreNivelLocal(a.nivel)}
                                        </strong>
                                        :{" "}
                                        {a.accion === "APROBADO"
                                            ? "Aprobó"
                                            : "Rechazó"}{" "}
                                        — {a.usuario_nombre ?? "—"}
                                        {a.motivo
                                            ? ` (${a.motivo})`
                                            : ""}
                                    </li>
                                ))}
                            </ul>
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

                {/* Pie */}
                {puedeOperar && (
                    <div className={styles.modalFooter}>
                        {rechazando ? (
                            <>
                                <textarea
                                    placeholder="Motivo del rechazo (obligatorio)"
                                    value={motivo}
                                    onChange={(e) =>
                                        setMotivo(e.target.value)
                                    }
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
                                    disabled={
                                        ocupado || !motivo.trim()
                                    }
                                    style={
                                        ocupado
                                            ? {
                                                  opacity: 0.6,
                                                  cursor: "not-allowed",
                                              }
                                            : undefined
                                    }
                                >
                                    {ocupado
                                        ? "Procesando…"
                                        : "Confirmar rechazo"}
                                </button>

                                <button
                                    className={`${styles.btn} ${styles.btnSecondary}`}
                                    disabled={ocupado}
                                    style={
                                        ocupado
                                            ? {
                                                  opacity: 0.6,
                                                  cursor: "not-allowed",
                                              }
                                            : undefined
                                    }
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
                                        try {
                                            await onAprobar(tarea);
                                        } catch {}
                                    }}
                                    disabled={ocupado}
                                    style={
                                        ocupado
                                            ? {
                                                  opacity: 0.6,
                                                  cursor: "not-allowed",
                                              }
                                            : undefined
                                    }
                                >
                                    {ocupado
                                        ? "Procesando…"
                                        : "Aprobar"}
                                </button>

                                <button
                                    className={`${styles.btn} ${styles.btnNo}`}
                                    onClick={() =>
                                        setRechazando(true)
                                    }
                                    disabled={ocupado}
                                    style={
                                        ocupado
                                            ? {
                                                  opacity: 0.6,
                                                  cursor: "not-allowed",
                                              }
                                            : undefined
                                    }
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

