"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./TaskModalDesarrollo.module.css";
import { Task, EquipoInfo, EquipoMiembroDetallado } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import SubtaskCountdown from "./SubtaskCountdown";
import TaskIniciarModal from "./TaskIniciarModal";
import Pagination from "../ui/Pagination";

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
    accionando?: number | null;
    onIniciar?: (
        tarea: Task,
        payload: {
            fecha_inicio: string;
            fecha_entrega_aproximada: string;
            incluye_sabado: boolean;
            subtareas: {
                descripcion: string;
                asignado: number;
                peso: number;
            }[];
        }
    ) => void | Promise<void>;
    onReasignarSubtarea?: (tareaId: number, subtareaId: number, nuevoAsignado: number) => Promise<void>;
    onInactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
    onReactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
    onTareaMutated?: () => void | Promise<void>;
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

type TabKey = "progreso" | "historial" | "asignaciones";

export default function TaskModal({
    tarea,
    onClose,
    onEmpezarTarea,
    onCompletarSubtarea,
    onCambiarEstadoSubtarea,
    empezandoId,
    completandoId,
    accionando,
    onIniciar,
    onReasignarSubtarea,
    onInactivarSubtarea,
    onReactivarSubtarea,
    onTareaMutated,
}: Props) {
    const [depBloqueada, setDepBloqueada] = useState<number | "">("");
    const [depBloqueadora, setDepBloqueadora] = useState<number | "">("");
    const [depMsg, setDepMsg] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>("progreso");
    const [logs, setLogs] = useState<LogItem[] | null>(null);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [mostrarIniciar, setMostrarIniciar] = useState(false);
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
    const [paginaHist, setPaginaHist] = useState(1);
    const histPageSize = 10;

    // Asignaciones tab state
    const [miembros, setMiembros] = useState<EquipoMiembroDetallado[]>([]);
    const [liderInfo, setLiderInfo] = useState<{ id: number; nombres: string; apellidos: string } | null>(null);
    const [miembrosLoading, setMiembrosLoading] = useState(false);
    const [miembrosError, setMiembrosError] = useState<string | null>(null);
    const [draftAsignado, setDraftAsignado] = useState<Record<number, number | "">>({});
    const [reasignandoId, setReasignandoId] = useState<number | null>(null);
    const [inactivandoId, setInactivandoId] = useState<number | null>(null);
    const [asigMsg, setAsigMsg] = useState<string | null>(null);
    const [asigErr, setAsigErr] = useState<string | null>(null);

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

    const cargarMiembros = async () => {
        if (!tarea) return;
        setMiembrosLoading(true);
        setMiembrosError(null);
        try {
            const data = await apiFetch<EquipoInfo>(`/api/usuarios/equipos/${tarea.equipo}/`);
            setMiembros(data.miembros ?? []);
            if (data.lider) {
                setLiderInfo({ id: data.lider.id, nombres: data.lider.nombres, apellidos: data.lider.apellidos });
            }
        } catch (e) {
            setMiembrosError((e as Error).message);
        } finally {
            setMiembrosLoading(false);
        }
    };

    useEffect(() => {
        if (tab === "historial" && tarea && logs === null && !logsLoading) {
            cargarLogs();
        }
        if (tab === "asignaciones" && tarea && miembros.length === 0 && !miembrosLoading && !miembrosError) {
            cargarMiembros();
        }
    }, [tab, tarea?.id]);

    // reset logs cuando cambia tarea
    useEffect(() => {
        setLogs(null);
        setLogsError(null);
        setTab("progreso");
        setExpandedLogs(new Set());
        setPaginaHist(1);
        setMiembros([]);
        setLiderInfo(null);
        setMiembrosError(null);
        setDraftAsignado({});
        setAsigMsg(null);
        setAsigErr(null);
    }, [tarea?.id]);

    useEffect(() => {
        setPaginaHist(1);
    }, [tab]);

    const logsPaginados = useMemo(() => {
        if (!logs) return [];
        const start = (paginaHist - 1) * histPageSize;
        return logs.slice(start, start + histPageSize);
    }, [logs, paginaHist]);

    const totalHistPages = logs ? Math.max(1, Math.ceil(logs.length / histPageSize)) : 1;

    const agregarDependencia = async () => {
        if (!tarea || depBloqueada === "" || depBloqueadora === "") { setDepMsg("Selecciona ambas subtareas"); return; }
        if (depBloqueada === depBloqueadora) { setDepMsg("No puede depender de sí misma"); return; }
        try {
            await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${depBloqueada}/dependencias/`, { method: "POST", body: JSON.stringify({ bloqueadora_id: depBloqueadora }) });
            setDepMsg("Dependencia creada. Recarga la tarea.");
            setDepBloqueada(""); setDepBloqueadora("");
            onTareaMutated?.();
        } catch (e) { setDepMsg((e as Error).message); }
    };

    const handleReasignar = async (subtareaId: number) => {
        if (!tarea) return;
        const nuevo = draftAsignado[subtareaId];
        if (nuevo === "" || nuevo === undefined) { setAsigErr("Selecciona un nuevo asignado"); return; }
        const subt = tarea.subtareas.find(s => s.id === subtareaId);
        if (subt && subt.asignado === nuevo) { setAsigErr("El nuevo asignado es el mismo que el actual"); return; }
        setAsigErr(null); setAsigMsg(null);
        setReasignandoId(subtareaId);
        try {
            if (onReasignarSubtarea) {
                await onReasignarSubtarea(tarea.id, subtareaId, nuevo as number);
            } else {
                await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${subtareaId}/reasignar/`, { method: "POST", body: JSON.stringify({ nuevo_asignado: nuevo }) });
            }
            setAsigMsg(`Subtarea #${subtareaId} reasignada`);
            setDraftAsignado(prev => ({ ...prev, [subtareaId]: "" }));
            if (onTareaMutated) await onTareaMutated();
            else window.location.reload();
        } catch (e) {
            setAsigErr((e as Error).message);
        } finally {
            setReasignandoId(null);
        }
    };

    const handleInactivar = async (subtareaId: number) => {
        if (!tarea) return;
        const ok = confirm("¿Inactivar subtarea? No contará en el progreso y se eliminarán sus dependencias. Se puede reactivar.");
        if (!ok) return;
        setAsigErr(null); setAsigMsg(null);
        setInactivandoId(subtareaId);
        try {
            if (onInactivarSubtarea) {
                await onInactivarSubtarea(tarea.id, subtareaId);
            } else {
                await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${subtareaId}/inactivar/`, { method: "POST" });
            }
            setAsigMsg(`Subtarea #${subtareaId} inactivada`);
            if (onTareaMutated) await onTareaMutated();
            else window.location.reload();
        } catch (e) {
            setAsigErr((e as Error).message);
        } finally {
            setInactivandoId(null);
        }
    };

    const handleReactivar = async (subtareaId: number) => {
        if (!tarea) return;
        setAsigErr(null); setAsigMsg(null);
        setInactivandoId(subtareaId);
        try {
            if (onReactivarSubtarea) {
                await onReactivarSubtarea(tarea.id, subtareaId);
            } else {
                await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${subtareaId}/reactivar/`, { method: "POST" });
            }
            setAsigMsg(`Subtarea #${subtareaId} reactivada`);
            if (onTareaMutated) await onTareaMutated();
            else window.location.reload();
        } catch (e) {
            setAsigErr((e as Error).message);
        } finally {
            setInactivandoId(null);
        }
    };

    // determinar si usuario puede ver historial: miembros del equipo (no cliente puro)
    const roles = (usuario?.roles ?? []).map((r: string) => r.toLowerCase());
    const esClientePuro = roles.includes("cliente") && !roles.includes("miembro") && !roles.includes("lider") && !roles.includes("sub_lider") && !roles.includes("administrador");
    const puedeVerHistorial = !esClientePuro;
    const puedeVerAsignaciones = !!tarea?.puedo_operar;

    // opciones asignables (miembros ACTIVO + lider)
    const opcionesAsignables = useMemo(() => {
        const map = new Map<number, string>();
        if (liderInfo) map.set(liderInfo.id, `${liderInfo.nombres} ${liderInfo.apellidos} (Líder)`);
        miembros.forEach(m => {
            if (m.estado === "ACTIVO") {
                map.set(m.usuario.id, `${m.usuario.nombres} ${m.usuario.apellidos}`);
            } else if (m.estado === "INDISPONIBLE") {
                // no incluir indisponibles
            }
        });
        // también incluir miembros aunque no estén en lista pero ya asignados (fallback)
        return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
    }, [miembros, liderInfo]);

    if (!tarea) return null;

    const subtareasProgreso = tarea.subtareas.filter(s => s.activo !== false);
    const subtareasInactivasCount = tarea.subtareas.length - subtareasProgreso.length;

    const tabButtonStyle = (active: boolean) => ({
        flex: 1,
        padding: "8px",
        borderRadius: 8,
        border: active ? "2px solid #3128bb" : "1px solid #d1d5db",
        background: active ? "#ede9fe" : "white",
        fontWeight: 700 as const,
        fontSize: 13,
        cursor: "pointer",
    });

    return (
        <>
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
                                    
                                    {tarea.tiempo_planificado_segundos !== null && tarea.tiempo_planificado_segundos !== undefined && (
                                        <tr>
                                            <td><strong>Tiempo planificado</strong></td>
                                            <td>{Math.floor(tarea.tiempo_planificado_segundos / 3600)}h {Math.floor((tarea.tiempo_planificado_segundos % 3600) / 60)}m</td>
                                        </tr>
                                    )}
                                    {(tarea as any).tiempo_planificado_efectivo_segundos && (tarea as any).segundos_extra > 0 && (
                                        <tr>
                                            <td><strong>Plan efectivo</strong></td>
                                            <td style={{ color: "#5b21b6", fontWeight: 700 }}>{Math.floor((tarea as any).tiempo_planificado_efectivo_segundos / 3600)}h {Math.floor(((tarea as any).tiempo_planificado_efectivo_segundos % 3600) / 60)}m <span style={{ background: "#ede9fe", border: "1px solid #ddd6fe", padding: "1px 6px", borderRadius: 999, fontSize: 10, marginLeft: 6 }}>+{Math.floor((tarea as any).segundos_extra / 3600)}h {Math.floor(((tarea as any).segundos_extra % 3600) / 60)}m anticipado</span></td>
                                        </tr>
                                    )}
                                    {(tarea as any).fecha_inicio_efectiva && (tarea as any).inicio_anticipado && (
                                        <tr>
                                            <td><strong>Inicio efectivo</strong></td>
                                            <td style={{ fontSize: 12 }}>{formatearFecha((tarea as any).fecha_inicio_efectiva)} <span style={{ color: "#6b7280" }}>(prog. {formatearFecha(tarea.fecha_inicio)})</span></td>
                                        </tr>
                                    )}

                                    {tarea.tiempo_tomado_formateado && tarea.estado === "SOLUCIONADO" && (
                                        <tr>
                                            <td><strong>Tiempo tomado (tarea)</strong></td>
                                            <td style={{ color: "#166534", fontWeight: 700 }}>{tarea.tiempo_tomado_formateado} ({tarea.tiempo_tomado_horas}h)</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td><strong>Sábados</strong></td>
                                        <td>{tarea.incluye_sabado ? "Sí (9:00-13:00)" : "No (solo L-V 9-18)"}</td>
                                    </tr>
                                    {tarea.estado === "APROBADO" && (
                                        <tr>
                                            <td>
                                                {tarea.puedo_operar && onIniciar && (
                                                    <button
                                                        className={styles.btnIniciar}
                                                        onClick={() => setMostrarIniciar(true)}
                                                        disabled={accionando === tarea.id}
                                                    >
                                                        Iniciar tarea
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )}


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
                                <button onClick={() => setTab("progreso")} style={tabButtonStyle(tab === "progreso")}>Progreso</button>
                                {puedeVerHistorial && <button onClick={() => setTab("historial")} style={tabButtonStyle(tab === "historial")}>Historial</button>}
                                {puedeVerAsignaciones && <button onClick={() => setTab("asignaciones")} style={tabButtonStyle(tab === "asignaciones")}>Asignaciones</button>}
                            </div>
                            {subtareasInactivasCount > 0 && tab === "progreso" && (
                                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{subtareasInactivasCount} subtarea(s) inactivada(s) — ver pestaña Asignaciones</p>
                            )}
                        </div>

                        <div className={styles.progresoSection}>
                            {tab === "progreso" ? (
                                <>
                                    <h3>Progreso — Subtareas</h3>

                                    {subtareasProgreso.length === 0 ? (
                                        <p className={styles.sinSubtareas}>
                                            {tarea.subtareas.length === 0
                                                ? "Esta tarea ha sido aprobada y se encuentra en proceso de asignación"
                                                : "Todas las subtareas activas han sido inactivadas. Revisa Asignaciones."}
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
                                                    {subtareasProgreso.map((subtarea) => {
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
                                                                                    ? styles.estadoEnStandBy
                                                                                    : ""
                                                                }
                                                            >
                                                                <td data-label="Descripción">
                                                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{subtarea.descripcion} {bloqueada && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, padding: "2px 6px", borderRadius: 6 }}>Bloqueada</span>}</div>
                                                                    <div style={{ fontSize: 10, color: "#6b7280" }}>Inicio: {formatearFecha(subtarea.fecha_inicio)} · Fin: {formatearFecha(subtarea.fecha_fin)} {subtarea.motivo_standby && <span style={{ color: "#92400e" }}>({subtarea.motivo_standby})</span>}</div>
                                                                    {subtarea.estado === "SOLUCIONADO" && subtarea.tiempo_tomado_formateado && <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>Tomado: {subtarea.tiempo_tomado_formateado} ({subtarea.tiempo_tomado_horas}h)</div>}
                                                                </td>
                                                                <td data-label="Asignado">{subtarea.asignado_nombre}</td>
                                                                <td data-label="Peso">{subtarea.peso}</td>
                                                                <td data-label="Contador / Tiempo">
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
                                                                <td data-label="Cambiar Estado">
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
                                            {subtareasProgreso.length > 1 && tarea.puedo_operar && (
                                                <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fafafa" }}>
                                                    <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Crear dependencia</h4>
                                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                                        <select value={depBloqueada} onChange={e => setDepBloqueada(e.target.value ? Number(e.target.value) : "")} className={styles.inputField} style={{ minWidth: 160 }}>
                                                            <option value="">-- subtarea --</option>
                                                            {subtareasProgreso.map(s => <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>)}
                                                        </select>
                                                        <span style={{ paddingBottom: 8 }}>depende de</span>
                                                        <select value={depBloqueadora} onChange={e => setDepBloqueadora(e.target.value ? Number(e.target.value) : "")} className={styles.inputField} style={{ minWidth: 160 }}>
                                                            <option value="">-- subtarea --</option>
                                                            {subtareasProgreso.map(s => <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>)}
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
                            ) : tab === "historial" ? (
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <h3 style={{ margin: 0 }}>Historial de la tarea</h3>
                                        <button onClick={cargarLogs} disabled={logsLoading} style={{ background: "white", border: "1px solid #d1d5db", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{logsLoading ? "Cargando..." : "Recargar"}</button>
                                    </div>
                                    {logsError && <p style={{ color: "#991b1b", fontSize: 12 }}>{logsError}</p>}
                                    {logsLoading && !logs && <p style={{ fontSize: 12 }}>Cargando logs...</p>}
                                    {logs && logs.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin registros.</p>}
                                    {logs && logs.length > 0 && (
                                        <div className={styles.subtareasContainer} style={{ maxHeight: 300, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                                            <table className={styles.subtareasTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Usuario</th>
                                                        <th>Evento</th>
                                                        <th>Detalle</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {logsPaginados.map((l) => {
                                                        const expanded = expandedLogs.has(l.id);
                                                        const detalle = l.detalle || `${l.estado_anterior ?? ""} → ${l.estado_nuevo ?? ""}`;
                                                        const necesitaClamp = detalle.length > 120;
                                                        return (
                                                        <tr key={l.id}>
                                                            <td data-label="Fecha" style={{ fontSize: 11 }}>{formatearFechaSec(l.fecha)}</td>
                                                            <td data-label="Usuario" style={{ fontSize: 11 }}>{l.usuario ?? "-"}</td>
                                                            <td data-label="Evento" style={{ fontSize: 11 }}><span style={{ background: "#e0e7ff", padding: "2px 6px", borderRadius: 6 }}>{l.tipo_evento}</span>{l.subtarea_id ? <div style={{ fontSize: 10, color: "#6b7280" }}>Sub #{l.subtarea_id}</div> : null}</td>
                                                            <td data-label="Detalle" style={{ fontSize: 11 }}>
                                                                <div className={necesitaClamp ? (expanded ? `${styles.historialClamp} ${styles.expanded}` : styles.historialClamp) : undefined}>{detalle}</div>
                                                                {necesitaClamp && (
                                                                    <button
                                                                        type="button"
                                                                        className={styles.historialToggle}
                                                                        onClick={() => setExpandedLogs(prev => {
                                                                            const n = new Set(prev);
                                                                            if (n.has(l.id)) n.delete(l.id); else n.add(l.id);
                                                                            return n;
                                                                        })}
                                                                    >
                                                                        {expanded ? "Ver menos" : "Ver más"}
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {logs && logs.length > histPageSize && (
                                        <Pagination page={paginaHist} totalPages={totalHistPages} totalItems={logs.length} pageSize={histPageSize} onPageChange={setPaginaHist} />
                                    )}
                                    <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>Solo miembros del equipo, líderes y sublíderes pueden ver este historial. El backend valida permisos.</p>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <h3 style={{ margin: 0 }}>Asignaciones</h3>
                                        <button onClick={cargarMiembros} disabled={miembrosLoading} style={{ background: "white", border: "1px solid #d1d5db", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{miembrosLoading ? "Cargando..." : "Recargar equipo"}</button>
                                    </div>
                                    <p style={{ fontSize: 11, color: "#6b7280", marginTop: -4, marginBottom: 8 }}>Cambia el asignado o inactiva subtareas. Solo líder / asignador / admin. Las inactivas no cuentan en progreso.</p>
                                    {miembrosError && <p style={{ color: "#991b1b", fontSize: 12 }}>{miembrosError}</p>}
                                    {asigErr && <p style={{ color: "#991b1b", fontSize: 12, background: "#fee2e2", padding: "6px 8px", borderRadius: 6 }}>{asigErr}</p>}
                                    {asigMsg && <p style={{ color: "#166534", fontSize: 12, background: "#dcfce7", padding: "6px 8px", borderRadius: 6 }}>{asigMsg}</p>}

                                    {tarea.subtareas.length === 0 ? (
                                        <p className={styles.sinSubtareas}>Sin subtareas para asignar. Usa “Iniciar tarea” en la cabecera si está aprobada.</p>
                                    ) : (
                                        <div className={styles.subtareasContainer} style={{ maxHeight: 360 }}>
                                            <table className={styles.subtareasTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Subtarea</th>
                                                        <th>Asignado actual</th>
                                                        <th>Nuevo asignado</th>
                                                        <th>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tarea.subtareas.map((subtarea) => {
                                                        const inactiva = subtarea.activo === false;
                                                        const esSolucionada = subtarea.estado === "SOLUCIONADO";
                                                        return (
                                                        <tr key={subtarea.id} style={inactiva ? { opacity: 0.7, background: "#f9fafb" } : undefined}>
                                                            <td data-label="Subtarea">
                                                                <div style={{ fontWeight: 600, fontSize: 12 }}>{subtarea.descripcion} {inactiva && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, padding: "2px 6px", borderRadius: 6, marginLeft: 6 }}>Inactiva</span>} {esSolucionada && <span style={{ background: "#dcfce7", color: "#166534", fontSize: 10, padding: "2px 6px", borderRadius: 6, marginLeft: 6 }}>Solucionada</span>}</div>
                                                                <div style={{ fontSize: 10, color: "#6b7280" }}>Peso {subtarea.peso} · Estado {subtarea.estado}</div>
                                                            </td>
                                                            <td data-label="Asignado actual">
                                                                <div style={{ fontSize: 12 }}>{subtarea.asignado_nombre}</div>
                                                                <div style={{ fontSize: 10, color: "#6b7280" }}>ID {subtarea.asignado}</div>
                                                            </td>
                                                            <td data-label="Nuevo asignado">
                                                                {inactiva || esSolucionada ? (
                                                                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{inactiva ? "Reactivar para reasignar" : "No reasignable"}</span>
                                                                ) : opcionesAsignables.length === 0 ? (
                                                                    <span style={{ fontSize: 11 }}>{miembrosLoading ? "Cargando..." : "Sin miembros activos"}</span>
                                                                ) : (
                                                                    <select
                                                                        value={draftAsignado[subtarea.id] ?? ""}
                                                                        onChange={e => setDraftAsignado(prev => ({ ...prev, [subtarea.id]: e.target.value ? Number(e.target.value) : "" }))}
                                                                        className={styles.estadoSelect}
                                                                        style={{ minWidth: 140, height: 34, fontSize: 12 }}
                                                                    >
                                                                        <option value="">-- seleccionar --</option>
                                                                        {opcionesAsignables.map(o => (
                                                                            <option key={o.id} value={o.id}>{o.nombre}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </td>
                                                            <td data-label="Acciones">
                                                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                                    {!inactiva && !esSolucionada && (
                                                                        <button
                                                                            onClick={() => handleReasignar(subtarea.id)}
                                                                            disabled={reasignandoId === subtarea.id || draftAsignado[subtarea.id] === "" || draftAsignado[subtarea.id] === undefined}
                                                                            style={{ background: "#2563eb", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, opacity: (draftAsignado[subtarea.id] === "" || draftAsignado[subtarea.id] === undefined) ? 0.5 : 1 }}
                                                                        >
                                                                            {reasignandoId === subtarea.id ? "..." : "Reasignar"}
                                                                        </button>
                                                                    )}
                                                                    {!inactiva ? (
                                                                        <button
                                                                            onClick={() => handleInactivar(subtarea.id)}
                                                                            disabled={esSolucionada || inactivandoId === subtarea.id || tarea.estado === "SOLUCIONADO"}
                                                                            title={esSolucionada ? "No se puede inactivar solucionada" : "Inactivar subtarea"}
                                                                            style={{ background: esSolucionada ? "#9ca3af" : "#ef4444", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: esSolucionada ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}
                                                                        >
                                                                            {inactivandoId === subtarea.id ? "..." : "Inactivar"}
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleReactivar(subtarea.id)}
                                                                            disabled={inactivandoId === subtarea.id || tarea.estado === "SOLUCIONADO"}
                                                                            style={{ background: "#16a34a", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                                                                        >
                                                                            {inactivandoId === subtarea.id ? "..." : "Reactivar"}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {mostrarIniciar && (
                <TaskIniciarModal
                    tarea={tarea}
                    accionando={accionando === tarea.id}
                    onClose={() => setMostrarIniciar(false)}
                    onSubmit={async (tarea, payload) => {
                        await onIniciar?.(tarea, payload);
                        window.location.reload();
                    }}
                />
            )}
        </>
    );
}
