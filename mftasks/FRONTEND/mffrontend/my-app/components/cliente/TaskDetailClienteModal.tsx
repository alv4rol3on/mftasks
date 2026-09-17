"use client";
import { useEffect, useMemo, useState } from "react";
import { Task } from "@/lib/types";
import { fetchLogs, LogItem } from "@/lib/services/tareasService";
import Pagination from "@/components/ui/Pagination";
import { apiBaseUrl } from "@/lib/authConfig";
import styles from "../tareas/TaskModalDesarrollo.module.css";

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
  const histPageSize = 15;

  const tareaId = tarea?.id;

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
                    <tr><td><strong>Estado</strong></td><td><span style={{ background: estadoColor[tarea.estado] ?? "#6b7280", padding:"2px 8px", borderRadius:6, color:"white", fontSize:11}}>{tarea.estado}</span></td></tr>

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
                    <div  className={styles.descriptionBox}>{tarea.motivo_standby}</div>
                  </>
                )}

                {tarea.archivos && tarea.archivos.length > 0 && (
                  <>
                    <h3>Adjuntos</h3>
                    <div style={{ marginTop: 6 }}>
                      {tarea.archivos.map((archivo) => (
                        <div key={archivo.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span aria-hidden="true">📎</span>
                          <a
                            href={`${apiBaseUrl}${archivo.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#1d4ed8", textDecoration: "underline", fontSize: 13 }}
                          >
                            Descargar {archivo.nombre}
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
                            <td data-label="Estado"><span style={{ background: estadoColor[s.estado] ?? "#6b7280", padding:"2px 6px", borderRadius:6, fontSize:11, color:"white"}}>{s.estado}</span></td>
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
            <div className={styles.progresoSection} style={{ gridColumn: "1 / -1" }}>
              <h3>Historial de la solicitud</h3>
              {logsLoading && !logs && <p style={{ fontSize: 12 }}>Cargando historial…</p>}
              {logsError && <p style={{ color: "#991b1b", fontSize: 12, background: "#fee2e2", padding: "6px 8px", borderRadius: 6 }}>{logsError}</p>}
              {logs && logs.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin registros.</p>}
              {logs && logs.length > 0 && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                    {logsPaginados.map((l) => (
                      <div key={l.id} style={{ borderLeft: "3px solid #c7d2fe", paddingLeft: 10 }}>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{fmt(l.fecha)}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{etiquetaLog(l)}</div>
                      </div>
                    ))}
                  </div>
                  {logs.length > histPageSize && (
                    <Pagination
                      page={paginaHistClamped}
                      totalPages={totalHistPages}
                      totalItems={logs.length}
                      pageSize={histPageSize}
                      onPageChange={setPaginaHist}
                    />
                  )}
                </>
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
