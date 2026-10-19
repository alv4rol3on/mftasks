"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchLogs, LogItem } from "@/lib/services/tareasService";
import Pagination from "../ui/Pagination";
import RefreshButton from "../ui/RefreshButton";
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
            <div className={styles.historyHeader}>
                <div>
                    <h3 className={styles.sectionTitle}>Historial de la solicitud</h3>
                    <p className={styles.sectionHint}>Trazabilidad de la solicitud y de sus subtareas.</p>
                </div>
                <RefreshButton onClick={cargarLogs} loading={recargando} variant="outline" title="Recargar historial" />
            </div>

            {logsError && <p className={styles.errorNotice}>{logsError}</p>}
            {!logs && !logsError && <p className={styles.sinSubtareas}>Cargando historial…</p>}
            {logs && logs.length === 0 && (
                <div className={styles.historyEmpty}>
                    <strong>Sin eventos registrados</strong>
                    <p>Cuando se realicen cambios en la solicitud aparecerán aquí.</p>
                </div>
            )}

            {logs && logs.length > 0 && (
                <ol className={styles.historyList} aria-label="Cronología de la solicitud">
                    {logsPaginados.map((l) => {
                        const expanded = expandedLogs.has(l.id);
                        const estados = [l.estado_anterior, l.estado_nuevo].filter(Boolean).join(" → ");
                        const detalle = l.detalle || estados || "Sin detalle";
                        const necesitaClamp = detalle.length > 120;
                        const esSubtarea = !!l.subtarea_id;

                        return (
                            <li key={l.id} className={styles.historyItem}>
                                <span
                                    className={`${styles.historyDot} ${esSubtarea ? styles.historyDotSubtask : styles.historyDotTask}`}
                                    aria-hidden="true"
                                />
                                <div className={styles.historyBody}>
                                    <div className={styles.historyTop}>
                                        <span className={styles.historyEvent}>
                                            {ETIQUETAS_EVENTO[l.tipo_evento] ?? l.tipo_evento}
                                        </span>
                                        <time className={styles.historyDate} dateTime={l.fecha}>
                                            {formatearFechaSec(l.fecha)}
                                        </time>
                                    </div>

                                    <div className={styles.historyMeta}>
                                        <span className={styles.historyUser}>{l.usuario ?? "Sistema"}</span>
                                        <span className={styles.historyEntity}>
                                            {esSubtarea
                                                ? `Subtarea ${l.subtarea_codigo ?? `#${l.subtarea_id}`}`
                                                : "Solicitud"}
                                        </span>
                                    </div>

                                    {esSubtarea && l.subtarea_descripcion && (
                                        <div className={styles.historySubtask}>{l.subtarea_descripcion}</div>
                                    )}

                                    <div className={necesitaClamp ? (expanded ? `${styles.historialClamp} ${styles.expanded}` : styles.historialClamp) : undefined}>
                                        {detalle}
                                    </div>

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
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {logs && logs.length > HIST_PAGE_SIZE && (
                <Pagination page={paginaClamped} totalPages={totalHistPages} totalItems={logs.length} pageSize={HIST_PAGE_SIZE} onPageChange={setPaginaHist} />
            )}
        </div>
    );
}
