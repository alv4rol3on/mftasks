"use client";
import { useEffect, useMemo, useState } from "react";
import { Task } from "@/lib/types";
import { fetchLogs, LogItem } from "@/lib/services/tareasService";
import Pagination from "@/components/ui/Pagination";
import AdjuntosTarea from "@/components/adjuntos/AdjuntosTarea";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import { apiFetch } from "@/lib/api";


const formatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const fmt = (f: string | null | undefined) => {
  if (!f) return "-";
  const d = new Date(f);
  return isNaN(d.getTime()) ? "-" : formatter.format(d);
};

const estadoColor: Record<string, string> = {
  EN_ESPERA: "#9ca3af",
  APROBADO: "#7c3aed",
  EN_DESARROLLO: "#2563eb",
  RECHAZADO: "#dc2626",
  SOLUCIONADO: "#16a34a",
  STAND_BY: "#d97706",
};

const estadoLabel: Record<string, string> = {
  EN_ESPERA: "En espera",
  APROBADO: "Aprobado",
  EN_DESARROLLO: "En desarrollo",
  STAND_BY: "En stand-by",
  SOLUCIONADO: "Solucionado",
  RECHAZADO: "Rechazado",
};

//PARA EL HISTORIAL
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




function etiquetaLog(l: LogItem): string {
  switch (l.tipo_evento) {
    case "CREACION":
      return "Solicitud creada";
    case "INICIO":
      return "Desarrollo iniciado";
    case "STANDBY_INICIO":
      return "Solicitud en pausa (stand-by)";
    case "STANDBY_FIN":
      return "Solicitud reanudada";
    case "FIN":
      return "Solicitud solucionada";
    case "CAMBIO_ESTADO":
      if (l.estado_anterior && l.estado_nuevo && l.estado_anterior !== l.estado_nuevo) {
        return `Estado: ${estadoLabel[l.estado_anterior] ?? l.estado_anterior} → ${estadoLabel[l.estado_nuevo] ?? l.estado_nuevo}`;
      }
      return "Cambio de estado";
    default:
      return l.estado_anterior && l.estado_nuevo
        ? `${estadoLabel[l.estado_anterior] ?? l.estado_anterior} → ${estadoLabel[l.estado_nuevo] ?? l.estado_nuevo}`
        : l.tipo_evento;
  }
}

type Props = { tarea: Task | null; onClose: () => void };

export default function TaskDetailClienteModal({ tarea, onClose }: Props) {
  const [tab, setTab] = useState<"detalle" | "historial">("detalle");
  const [logs, setLogs] = useState<LogItem[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [paginaHist, setPaginaHist] = useState(1);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const histPageSize = 15;

  const tareaId = tarea?.id;

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

  // Cargar historial al abrir la pestaña
  useEffect(() => {
    if (tab !== "historial" || !tareaId || logs !== null) return;
    let cancelado = false;
    const run = async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const data = await fetchLogs(tareaId);
        if (!cancelado) setLogs(data);
      } catch (e) {
        if (!cancelado) setLogsError((e as Error).message);
      } finally {
        if (!cancelado) setLogsLoading(false);
      }
    };
    run();
    return () => { cancelado = true; };
  }, [tab, tareaId, logs]);

  const totalHistPages = logs ? Math.max(1, Math.ceil(logs.length / histPageSize)) : 1;
  const paginaHistClamped = Math.min(paginaHist, totalHistPages);
  const logsPaginados = useMemo(() => {
    if (!logs) return [];
    const start = (paginaHistClamped - 1) * histPageSize;
    return logs.slice(start, start + histPageSize);
  }, [logs, paginaHistClamped]);

  if (!tarea) return null;
  const progresoNum = parseFloat(String(tarea.progreso ?? 0)) || 0;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2>Solicitud #{tarea.id}</h2>
            <p>{tarea.asunto} — <span style={{ background: estadoColor[tarea.estado] ?? "#6b7280", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{tarea.estado}</span></p>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.tabsHeader} style={{ gridColumn: "1 / -1" }}>
            <button
              onClick={() => setTab("detalle")}
              className={tab === "detalle" ? styles.tabBtnActive : styles.tabBtn}
            >
              Detalle
            </button>
            <button
              onClick={() => { setTab("historial"); setPaginaHist(1); }}
              className={tab === "historial" ? styles.tabBtnActive : styles.tabBtn}
            >
              Historial
            </button>
          </div>

          {tab === "detalle" ? (
            <>
              <div className={styles.modalColumn}>
                <h3>Información</h3>
                <table className={styles.infoTable}>
                  <tbody>
                    <tr><td><strong>Campaña</strong></td><td>{tarea.campana_nombre ?? tarea.cliente_nombre}</td></tr>
                    <tr><td><strong>Subcampaña</strong></td><td>{tarea.subcampana_nombre ?? "-"}</td></tr>
                    <tr><td><strong>Equipo</strong></td><td>{tarea.equipo_nombre}</td></tr>
                    <tr><td><strong>Estado</strong></td><td><span style={{ background: estadoColor[tarea.estado] ?? "#6b7280", padding: "2px 8px", borderRadius: 6, color: "white", fontSize: 11 }}>{tarea.estado}</span></td></tr>

                    <tr><td><strong>Fecha solicitud</strong></td><td>{fmt(tarea.fecha_creacion)}</td></tr>

                    {tarea.estado !== "RECHAZADO" && (
                      <>
                        <tr>
                          <td><strong>Fecha inicio</strong></td>
                          <td>{fmt(tarea.fecha_inicio)}</td>
                        </tr>
                        <tr>
                          <td><strong>Entrega aprox.</strong></td>
                          <td>{fmt(tarea.fecha_entrega_aproximada)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className={styles.modalColumn}>
                <h3>Descripción</h3>
                <div className={styles.descriptionBox}>{tarea.descripcion}</div>

                {tarea.estado == "RECHAZADO" && (
                  <>
                    <h3>Motivo de rechazo</h3>
                    <div className={styles.descriptionBox}>{tarea.motivo_rechazo}</div>
                  </>
                )}

                {tarea.estado === "STAND_BY" && (
                  <>
                    <h3>Motivo pausa</h3>
                    <div className={styles.descriptionBox}>{tarea.motivo_standby}</div>
                  </>
                )}

                <AdjuntosTarea archivos={tarea.archivos} tareaId={tarea.id} ticket={tarea.ticket} titulo="Adjuntos" />
              </div>
              <div className={styles.progresoSection} style={{ gridColumn: "1 / -1" }}>
                <h3>Progreso — {progresoNum.toFixed(2)}%</h3>
                <div style={{ background: "#e5e7eb", borderRadius: 8, height: 14, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: `${Math.min(100, progresoNum)}%`, background: progresoNum === 100 ? "#16a34a" : "#2563eb", height: "100%", transition: "width .3s" }} />
                </div>
                {tarea.subtareas.length === 0 ? (
                  <p className={styles.sinSubtareas}>
                    {tarea.estado === "EN_ESPERA" ? "Tu solicitud está en espera de una respuesta por parte del equipo asignado" : tarea.estado === "RECHAZADO" ? "Solicitud rechazada." : tarea.estado === "SOLUCIONADO" ? "Solicitud completada." : "Aprobada, en proceso de asignación de tareas."}
                  </p>
                ) : (
                  <div className={styles.subtareasContainer}>
                    <table className={styles.subtareasTable}>
                      <thead>
                        <tr>
                          <th>Subtarea</th>
                          <th>Estado</th>
                          <th>Peso</th>
                          <th>Asignado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {tarea.subtareas.map((s) => (
                          <tr
                            key={s.id}
                            className={
                              s.estado === "SOLUCIONADO"
                                ? styles.estadoSolucionado
                                : s.estado === "EN_DESARROLLO"
                                  ? styles.estadoEnDesarrollo
                                  : s.estado === "STAND_BY"
                                    ? styles.estadoEnStandBy
                                    : styles.estadoEnEspera
                            }
                            title={s.motivo_standby || ""}
                          >
                            <td data-label="Subtarea">{s.descripcion}</td>
                            <td data-label="Estado"><span style={{ background: estadoColor[s.estado] ?? "#6b7280", padding: "2px 6px", borderRadius: 6, fontSize: 11, color: "white" }}>{s.estado}</span></td>
                            <td data-label="Peso">{s.peso}</td>
                            <td data-label="Asignado">{s.asignado_nombre}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              {/* HISTORIAL */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <button onClick={cargarLogs} disabled={logsLoading} style={{ background: "white", border: "1px solid #d1d5db", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{logsLoading ? "Cargando..." : "Recargar"}</button>
              </div>
              {logsError && <p style={{ color: "#991b1b", fontSize: 12 }}>{logsError}</p>}
              {logsLoading && !logs && <p style={{ fontSize: 12 }}>Cargando logs...</p>}
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
              {logs && logs.length > histPageSize && (
                <Pagination page={paginaHist} totalPages={totalHistPages} totalItems={logs.length} pageSize={histPageSize} onPageChange={setPaginaHist} />
              )}
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div >
  );
}
