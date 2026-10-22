"use client";
import { useState } from "react";
import { Task } from "@/lib/types";
import AdjuntosTarea from "@/components/adjuntos/AdjuntosTarea";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import HistorialTarea from "../tareas/HistorialTarea";
import TaskStatusBadge from "@/components/tareas/TaskStatusBadge";


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

type Props = { tarea: Task | null; onClose: () => void };

export default function TaskDetailClienteModal({ tarea, onClose }: Props) {
  const [tab, setTab] = useState<"detalle" | "historial">("detalle");

  if (!tarea) return null;
  const progresoNum = parseFloat(String(tarea.progreso ?? 0)) || 0;

  const sinAprobar = tarea.estado === "EN_ESPERA" || tarea.estado === "RECHAZADO"

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2>Solicitud #{tarea.ticket}</h2>
            <p>{tarea.asunto} — <TaskStatusBadge estado={tarea.estado} compact /></p>
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
              onClick={() => setTab("historial")}
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
                    <tr><td><strong>Entidad</strong></td><td>{tarea.entidad_nombre ?? tarea.cliente_nombre ?? "-"}</td></tr>
                    <tr><td><strong>Campaña</strong></td><td>{tarea.campana_nombre ?? "-"}</td></tr>
                    <tr><td><strong>Subcampaña</strong></td><td>{tarea.subcampana_nombre ?? "-"}</td></tr>
                    <tr><td><strong>Equipo</strong></td><td>{tarea.equipo_nombre}</td></tr>
                    <tr><td><strong>Estado</strong></td><td><TaskStatusBadge estado={tarea.estado} compact /></td></tr>

                    <tr><td><strong>Fecha solicitud</strong></td><td>{fmt(tarea.fecha_creacion)}</td></tr>

                    {!sinAprobar && (
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

                {tarea.estado === "CANCELADO" && (
                  <>
                    <h3>Motivo de cancelación</h3>
                    <div className={styles.descriptionBox}>{tarea.motivo_cancelacion || "Sin motivo registrado."}</div>
                  </>
                )}

                {tarea.estado === "STAND_BY" && (
                  <>
                    <h3>Motivo de la pausa</h3>
                    <div className={styles.descriptionBox}>{tarea.motivo_standby}</div>
                  </>
                )}

                <AdjuntosTarea archivos={tarea.archivos} tareaId={tarea.id} ticket={tarea.ticket} titulo="Adjuntos" />
              </div>
              <div className={styles.progresoSection} style={{ gridColumn: "1 / -1" }}>
                {sinAprobar ?
                  (
                    null
                  ) : (
                    <>
                    <h3>Progreso — {progresoNum.toFixed(2)}%</h3>
                    <div style={{ background: "var(--color-border)", borderRadius: 8, height: 14, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ width: `${Math.min(100, progresoNum)}%`, background: progresoNum === 100 ? "var(--color-done)" : "var(--color-in-progress)", height: "100%", transition: "width .3s" }} />
                    </div>
                  </>
                  )

                }

                {tarea.subtareas.length === 0 ? (
                  <p className={styles.sinSubtareas}>
                    {tarea.estado === "EN_ESPERA" ? null : tarea.estado === "RECHAZADO" ? "Solicitud rechazada." : tarea.estado === "SOLUCIONADO" ? "Solicitud completada." : "Aprobada, en proceso de asignación de tareas."}
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
                            <td data-label="Estado"><TaskStatusBadge estado={s.estado} compact /></td>
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
            <HistorialTarea key={tarea.id} tareaId={tarea.id} />
          )}
        </div>
      </div>
    </div >
  );
}
