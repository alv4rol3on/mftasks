"use client";

import { useState, useEffect } from "react";
import styles from "./TaskModalDesarrollo.module.css";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import SubtaskCountdown from "./SubtaskCountdown";

const formatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const formatterSec = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});

const formatearFecha = (fecha: string | null | undefined) => {
    if (!fecha) return "-";
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "-";
    return formatter.format(date);
};

const formatearFechaSec = (fecha: string | null | undefined) => {
    if (!fecha) return "-";
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "-";
    return formatterSec.format(date);
};

type Props = {
    tarea: Task | null;
    onClose: () => void;
    onEmpezarTarea?: (tareaId: number, subtareaId: number) => void;
    onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
    onCambiarEstadoSubtarea?: (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => void;
    empezandoId?: number | null;
    completandoId?: number | null;
};

interface LogItem {
    id: number;
    tipo_evento: string;
    estado_anterior: string | null;
    estado_nuevo: string | null;
    fecha: string;
    detalle: string;
    usuario: string | null;
    subtarea_id: number | null;
    subtarea_descripcion: string | null;
}

export default function TaskModal({ tarea, onClose, onEmpezarTarea, onCompletarSubtarea, onCambiarEstadoSubtarea, empezandoId, completandoId }: Props) {
    const [depBloqueada, setDepBloqueada] = useState<number | "">("");
    const [depBloqueadora, setDepBloqueadora] = useState<number | "">("");
    const [depMsg, setDepMsg] = useState<string | null>(null);
    const [tab, setTab] = useState<"subtareas" | "historial">("subtareas");
    const [logs, setLogs] = useState<LogItem[] | null>(null);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [logsLoading, setLogsLoading] = useState(false);

    const usuario = getUsuarioActual();

    const cargarLogs = async () => {
        if (!tarea) return;
        setLogsLoading(true);
        setLogsError(null);
        try {
            const data = await apiFetch<LogItem[]>(`/api/tasks/tasks/${tarea.id}/logs/`);
            setLogs(data);
        } catch (e) {
            setLogsError((e as Error).message);
        } finally {
            setLogsLoading(false);
        }
    };

    useEffect(() => {
        if (tab === "historial" && tarea && logs === null && !logsLoading) {
            cargarLogs();
        }
    }, [tab, tarea?.id]);

    // reset logs cuando cambia tarea
    useEffect(() => {
        setLogs(null);
        setLogsError(null);
        setTab("subtareas");
    }, [tarea?.id]);

    const agregarDependencia = async () => {
        if (!tarea || depBloqueada === "" || depBloqueadora === "") { setDepMsg("Selecciona ambas subtareas"); return; }
        if (depBloqueada === depBloqueadora) { setDepMsg("No puede depender de sí misma"); return; }
        try {
            await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${depBloqueada}/dependencias/`, { method: "POST", body: JSON.stringify({ bloqueadora_id: depBloqueadora }) });
            setDepMsg("Dependencia creada. Recarga la tarea.");
            setDepBloqueada(""); setDepBloqueadora("");
        } catch (e) { setDepMsg((e as Error).message); }
    };

    // determinar si usuario puede ver historial: miembros del equipo (no cliente puro)
    const roles = (usuario?.roles ?? []).map((r: string) => r.toLowerCase());
    const esClientePuro = roles.includes("cliente") && !roles.includes("miembro") && !roles.includes("lider") && !roles.includes("sub_lider") && !roles.includes("administrador");
    const puedeVerHistorial = !esClientePuro;

    if (!tarea) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <div>
                        <h2>{tarea.ticket ? `${tarea.ticket} · ` : ""}Tarea #{tarea.id}</h2>
                        <p>{tarea.asunto}</p>
                        {tarea.incluye_sabado && <span style={{ background: "#f59e0b", color: "black", fontSize: 11, padding: "2px 6px", borderRadius: 6, marginTop: 4, display: "inline-block" }}>Incluye sábados 9-13</span>}
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
                                    <td><strong>Solicitante</strong></td>
                                    <td>{tarea.solicitante_nombre}</td>
                                </tr>

                                <tr>
                                    <td><strong>Campaña</strong></td>
                                    <td>{tarea.campana_nombre ?? tarea.cliente_nombre}</td>
                                </tr>
                                {tarea.subcampana_nombre && (
                                    <tr>
                                        <td><strong>Subcampaña</strong></td>
                                        <td>{tarea.subcampana_nombre}</td>
                                    </tr>
                                )}

                                <tr>
                                    <td><strong>Equipo</strong></td>
                                    <td>{tarea.equipo_nombre}</td>
                                </tr>

                                <tr>
                                    <td><strong>Estado</strong></td>
                                    <td>{tarea.estado} {tarea.estado === "SOLUCIONADO" && tarea.fecha_solucion ? `· ${formatearFecha(tarea.fecha_solucion)}` : ""}</td>
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
                                {tarea.fecha_solucion && (
                                    <tr>
                                        <td><strong>Fecha de solución</strong></td>
                                        <td>{formatearFechaSec(tarea.fecha_solucion)}</td>
                                    </tr>
                                )}
                                {tarea.tiempo_tomado_formateado && tarea.estado === "SOLUCIONADO" && (
                                    <tr>
                                        <td><strong>Tiempo tomado (tarea)</strong></td>
                                        <td style={{ color: "#166534", fontWeight: 700 }}>{tarea.tiempo_tomado_formateado} ({tarea.tiempo_tomado_horas}h)</td>
                                    </tr>
                                )}
                                {tarea.tiempo_planificado_segundos !== null && tarea.tiempo_planificado_segundos !== undefined && (
                                    <tr>
                                        <td><strong>Tiempo planificado</strong></td>
                                        <td>{Math.floor(tarea.tiempo_planificado_segundos / 3600)}h {Math.floor((tarea.tiempo_planificado_segundos % 3600)/60)}m</td>
                                    </tr>
                                )}
                                <tr>
                                    <td><strong>Sábados</strong></td>
                                    <td>{tarea.incluye_sabado ? "Sí (9:00-13:00)" : "No (solo L-V 9-18)"}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.modalColumn}>
                        <h3>Descripción</h3>

                        <div className={styles.descriptionBox}>
                            {tarea.descripcion}
                        </div>
                        {/* Tabs */}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button onClick={() => setTab("subtareas")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: tab === "subtareas" ? "2px solid #3128bb" : "1px solid #d1d5db", background: tab === "subtareas" ? "#ede9fe" : "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Subtareas</button>
                            {puedeVerHistorial && <button onClick={() => setTab("historial")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: tab === "historial" ? "2px solid #3128bb" : "1px solid #d1d5db", background: tab === "historial" ? "#ede9fe" : "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Historial</button>}
                        </div>
                    </div>

                    <div className={styles.progresoSection}>
                        {tab === "subtareas" ? (
                            <>
                                <h3>Progreso — Subtareas</h3>

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
                                                    <th>Peso</th>
                                                    <th>Contador / Tiempo</th>
                                                    <th>Cambiar Estado</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {tarea.subtareas.map((subtarea) => {
                                                    const esMiSubtarea = usuario?.id === subtarea.asignado;
                                                    const bloqueadorasPendientes = subtarea.bloqueada_por?.filter(b => b.estado !== "SOLUCIONADO") ?? [];
                                                    const bloqueada = bloqueadorasPendientes.length > 0;
                                                    const bloqueadaTooltip = bloqueada ? `Bloqueada por: ${bloqueadorasPendientes.map(b => `${b.descripcion} (${b.estado})`).join(", ")}` : "";
                                                    const puedeEmpezar = esMiSubtarea && subtarea.estado === "EN_ESPERA" && !!onEmpezarTarea && !bloqueada;
                                                    const puedeCompletar = esMiSubtarea && subtarea.estado === "EN_DESARROLLO" && !!onCompletarSubtarea;
                                                    return (
                                                        <tr
                                                            key={subtarea.id}
                                                            title={bloqueadaTooltip || subtarea.motivo_standby || ""}
                                                            className={
                                                                subtarea.estado === "EN_ESPERA"
                                                                    ? styles.estadoEnEspera
                                                                    : subtarea.estado === "EN_DESARROLLO"
                                                                        ? styles.estadoEnDesarrollo
                                                                        : subtarea.estado === "SOLUCIONADO"
                                                                            ? styles.estadoSolucionado
                                                                            : subtarea.estado === "STAND_BY"
                                                                                ? styles.estadoEnEspera
                                                                                : ""
                                                            }
                                                        >
                                                            <td>
                                                                <div style={{ fontWeight: 600, fontSize: 12 }}>{subtarea.descripcion} {bloqueada && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, padding: "2px 6px", borderRadius: 6 }}>Bloqueada</span>}</div>
                                                                <div style={{ fontSize: 10, color: "#6b7280" }}>Inicio: {formatearFecha(subtarea.fecha_inicio)} · Fin: {formatearFecha(subtarea.fecha_fin)} {subtarea.motivo_standby && <span style={{ color: "#92400e" }}>({subtarea.motivo_standby})</span>}</div>
                                                                {subtarea.estado === "SOLUCIONADO" && subtarea.tiempo_tomado_formateado && <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>Tomado: {subtarea.tiempo_tomado_formateado} ({subtarea.tiempo_tomado_horas}h)</div>}
                                                            </td>
                                                            <td>{subtarea.asignado_nombre}</td>
                                                            <td>{subtarea.peso}</td>
                                                            <td>
                                                                <SubtaskCountdown
                                                                    tareaId={tarea.id}
                                                                    subtareaId={subtarea.id}
                                                                    estado={subtarea.estado}
                                                                    incluyeSabado={tarea.incluye_sabado}
                                                                    fallbackTiempoTomado={subtarea.tiempo_tomado_segundos}
                                                                    fallbackFormateado={subtarea.tiempo_tomado_formateado ?? undefined}
                                                                />
                                                                {subtarea.fecha_inicio && !subtarea.fecha_fin && <div style={{ fontSize: 10, color: "#6b7280" }}>Iniciada {formatearFecha(subtarea.fecha_inicio)}</div>}
                                                            </td>
                                                            <td>
                                                                {esMiSubtarea && onCambiarEstadoSubtarea ? (
                                                                    subtarea.estado === "SOLUCIONADO" ? (
                                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#000000", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "1px solid #86efac" }}>✓ Solucionado</span>
                                                                    ) : subtarea.estado === "STAND_BY" ? (
                                                                        <button
                                                                            onClick={() => onCambiarEstadoSubtarea(tarea.id, subtarea.id, "EN_ESPERA")}
                                                                            style={{ background: "#f59e0b", color: "black", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                                                                            title="Reanudar - volverá a En espera"
                                                                        >
                                                                            REANUDAR
                                                                        </button>
                                                                    ) : (
                                                                        <select
                                                                            value={subtarea.estado}
                                                                            onChange={(e) => {
                                                                                const nuevo = e.target.value;
                                                                                if (bloqueada && nuevo === "EN_DESARROLLO") {
                                                                                    alert(`Bloqueada por: ${bloqueadorasPendientes.map(b => b.descripcion).join(", ")} - debe solucionarse primero`);
                                                                                    return;
                                                                                }
                                                                                if (nuevo === "SOLUCIONADO") {
                                                                                    const ok = confirm("¿Terminar subtarea? Se bloqueará en Solucionado.");
                                                                                    if (!ok) return;
                                                                                }
                                                                                if (nuevo === "STAND_BY") {
                                                                                    const motivo = prompt("Motivo de pausa (STAND_BY) obligatorio:");
                                                                                    if (!motivo || !motivo.trim()) return;
                                                                                    onCambiarEstadoSubtarea(tarea.id, subtarea.id, nuevo, motivo.trim());
                                                                                } else {
                                                                                    onCambiarEstadoSubtarea(tarea.id, subtarea.id, nuevo);
                                                                                }
                                                                            }}
                                                                            className={styles.estadoSelect}
                                                                            disabled={bloqueada && subtarea.estado === "EN_ESPERA"}
                                                                            title={bloqueadaTooltip || "Cambiar estado"}
                                                                        >
                                                                            <option value="EN_ESPERA">En espera</option>
                                                                            <option value="EN_DESARROLLO">En desarrollo</option>
                                                                            <option value="STAND_BY">Stand-by</option>
                                                                            <option value="SOLUCIONADO">Solucionado</option>
                                                                        </select>
                                                                    )
                                                                ) : puedeEmpezar ? (
                                                                    <button
                                                                        onClick={() => onEmpezarTarea!(tarea.id, subtarea.id)}
                                                                        disabled={empezandoId === subtarea.id}
                                                                        title={bloqueadaTooltip}
                                                                        style={{
                                                                            background: bloqueada ? "#9ca3af" : "#0891b2",
                                                                            color: "white",
                                                                            border: "none",
                                                                            padding: "4px 10px",
                                                                            borderRadius: 6,
                                                                            cursor: bloqueada ? "not-allowed" : "pointer",
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        {bloqueada ? "Bloqueada" : empezandoId === subtarea.id ? "Iniciando…" : "Empezar"}
                                                                    </button>
                                                                ) : puedeCompletar ? (
                                                                    <button
                                                                        onClick={() => onCompletarSubtarea!(tarea.id, subtarea.id)}
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
                                                                        {completandoId === subtarea.id ? "Guardando…" : "Marcar como completado"}
                                                                    </button>
                                                                ) : subtarea.estado === "SOLUCIONADO" ? (
                                                                    <span style={{ color: "#FFFFFF", fontSize: 12 }}>✓ Terminada</span>
                                                                ) : subtarea.estado === "STAND_BY" ? (
                                                                    <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>Pausada</span>
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

                                {tarea.estado !== "SOLUCIONADO" ? (
                                    <>
                                        {tarea.subtareas.length > 1 && tarea.puedo_operar && (
                                            <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fafafa" }}>
                                                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Crear dependencia</h4>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                                    <select value={depBloqueada} onChange={e => setDepBloqueada(e.target.value ? Number(e.target.value) : "")} className={styles.inputField} style={{ minWidth: 160 }}>
                                                        <option value="">-- subtarea --</option>
                                                        {tarea.subtareas.map(s => <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>)}
                                                    </select>
                                                    <span style={{ paddingBottom: 8 }}>depende de</span>
                                                    <select value={depBloqueadora} onChange={e => setDepBloqueadora(e.target.value ? Number(e.target.value) : "")} className={styles.inputField} style={{ minWidth: 160 }}>
                                                        <option value="">-- subtarea --</option>
                                                        {tarea.subtareas.map(s => <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>)}
                                                    </select>
                                                    <button onClick={agregarDependencia} className={`${styles.btn} ${styles.btnYes}`} style={{ fontSize: 12 }}>Agregar</button>
                                                </div>
                                                {depMsg && <p style={{ fontSize: 12, color: depMsg.includes("creada") ? "#166534" : "#991b1b", margin: "8px 0 0" }}>{depMsg}</p>}
                                            </div>
                                        )}
                                    </>

                                ) : (
                                    <div></div>
                                )}
                            </>
                        ) : (
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <h3 style={{ margin: 0 }}>Historial de la tarea</h3>
                                    <button onClick={cargarLogs} disabled={logsLoading} style={{ background: "white", border: "1px solid #d1d5db", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{logsLoading ? "Cargando..." : "Recargar"}</button>
                                </div>
                                {logsError && <p style={{ color: "#991b1b", fontSize: 12 }}>{logsError}</p>}
                                {logsLoading && !logs && <p style={{ fontSize: 12 }}>Cargando logs...</p>}
                                {logs && logs.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin registros.</p>}
                                {logs && logs.length > 0 && (
                                    <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                                        <table className={styles.subtareasTable} style={{ minWidth: 600 }}>
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Usuario</th>
                                                    <th>Evento</th>
                                                    <th>Detalle</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.map((l) => (
                                                    <tr key={l.id}>
                                                        <td style={{ fontSize: 11 }}>{formatearFechaSec(l.fecha)}</td>
                                                        <td style={{ fontSize: 11 }}>{l.usuario ?? "-"}</td>
                                                        <td style={{ fontSize: 11 }}><span style={{ background: "#e0e7ff", padding: "2px 6px", borderRadius: 6 }}>{l.tipo_evento}</span>{l.subtarea_id ? <div style={{ fontSize: 10, color: "#6b7280" }}>Sub #{l.subtarea_id}</div> : null}</td>
                                                        <td style={{ fontSize: 11 }}>{l.detalle || `${l.estado_anterior ?? ""} → ${l.estado_nuevo ?? ""}`}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>Solo miembros del equipo, líderes y sublíderes pueden ver este historial. El backend valida permisos.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
