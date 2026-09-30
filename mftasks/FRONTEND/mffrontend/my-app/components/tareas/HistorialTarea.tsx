"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchLogs, LogItem } from "@/lib/services/tareasService";
import Pagination from "../ui/Pagination";
import styles from "./TaskModalDesarrollo.module.css";

const HIST_PAGE_SIZE = 10;

const formatterSec = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});

const formatearFechaSec = (fecha: string | null | undefined) => {
    if (!fecha) return "-";
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "-";
    return formatterSec.format(date);
};

const ETIQUETAS_EVENTO: Record<string, string> = {
    CREACION: "Creación",
    INICIO: "Inicio",
    CAMBIO_ESTADO: "Cambio de estado",
    STANDBY_INICIO: "Inicio de pausa",
    STANDBY_FIN: "Fin de pausa",
    FIN: "Fin",
    CAMBIO_ASIGNADO: "Reasignación",
    CAMBIO_PROGRESO: "Cambio de progreso",
};

type Props = {
    tareaId: number;
};

export default function HistorialTarea({ tareaId }: Props) {
    const [logs, setLogs] = useState<LogItem[] | null>(null);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [recargando, setRecargando] = useState(false);
    const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
    const [paginaHist, setPaginaHist] = useState(1);

    useEffect(() => {
        let cancelado = false;
        fetchLogs(tareaId)
            .then((data) => {
                if (!cancelado) setLogs(data);
            })
            .catch((e) => {
                if (!cancelado) setLogsError((e as Error).message);
            });
        return () => {
            cancelado = true;
        };
    }, [tareaId]);

    const cargarLogs = async () => {
        setRecargando(true);
        setLogsError(null);
        try {
            const data = await fetchLogs(tareaId);
            setLogs(data);
        } catch (e) {
            setLogsError((e as Error).message);
        } finally {
            setRecargando(false);
        }
    };

    const totalHistPages = logs ? Math.max(1, Math.ceil(logs.length / HIST_PAGE_SIZE)) : 1;
    const paginaClamped = Math.min(paginaHist, totalHistPages);
    const logsPaginados = useMemo(() => {
        if (!logs) return [];
        const start = (paginaClamped - 1) * HIST_PAGE_SIZE;
        return logs.slice(start, start + HIST_PAGE_SIZE);
    }, [logs, paginaClamped]);

    return (
        <div className={styles.historialTabContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Historial de la tarea</h3>
                <button onClick={cargarLogs} disabled={recargando} style={{ background: "white", border: "1px solid #d1d5db", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{recargando ? "Cargando..." : "Recargar"}</button>
            </div>
            {logsError && <p style={{ color: "#991b1b", fontSize: 12 }}>{logsError}</p>}
            {!logs && !logsError && <p style={{ fontSize: 12 }}>Cargando logs...</p>}
            {logs && logs.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin registros.</p>}
            {logs && logs.length > 0 && (
                <div className={styles.historialContainer}>
                    <table className={`${styles.subtareasTable} ${styles.historialTable}`}>
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
                                        <td data-label="Fecha">{formatearFechaSec(l.fecha)}</td>
                                        <td data-label="Usuario">{l.usuario ?? "-"}</td>
                                        <td data-label="Evento"><span title={l.tipo_evento} style={{ background: "#e0e7ff", padding: "2px 6px", borderRadius: 6 }}>{ETIQUETAS_EVENTO[l.tipo_evento] ?? l.tipo_evento}</span>{l.subtarea_id ? <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>{l.subtarea_codigo ?? `Sub #${l.subtarea_id}`}</div> : null}</td>
                                        <td data-label="Detalle">
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
            {logs && logs.length > HIST_PAGE_SIZE && (
                <Pagination page={paginaClamped} totalPages={totalHistPages} totalItems={logs.length} pageSize={HIST_PAGE_SIZE} onPageChange={setPaginaHist} />
            )}
        </div>
    );
}
