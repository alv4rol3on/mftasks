"use client";
import { useState } from "react";
import { Task } from "@/lib/types";
import { apiFetchBlob } from "@/lib/api";
import AdjuntosTarea from "@/components/adjuntos/AdjuntosTarea";
import RichTextView from "@/components/shared/RichTextView";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import HistorialTarea from "../tareas/HistorialTarea";
import TaskStatusBadge from "@/components/tareas/TaskStatusBadge";
import CancelarSolicitudModal from "@/components/solicitudes/CancelarSolicitudModal";
import AgregarInformacionModal from "./AgregarInformacionModal";
import ConfirmarSolucionModal from "./ConfirmarSolucionModal";
import ReabrirSolicitudModal from "./ReabrirSolicitudModal";


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

const accionBtn = {
  background: "var(--color-background)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: "7px 12px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

type Props = {
  tarea: Task | null;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
};

type Accion = "cancelar" | "informacion" | "confirmar" | "reabrir" | null;

export default function TaskDetailClienteModal({ tarea, onClose, onRefresh }: Props) {
  const [tab, setTab] = useState<"detalle" | "historial">("detalle");
  const [accion, setAccion] = useState<Accion>(null);
  const [descargando, setDescargando] = useState(false);
  const [descargaError, setDescargaError] = useState<string | null>(null);

  if (!tarea) return null;
  const progresoNum = parseFloat(String(tarea.progreso ?? 0)) || 0;

  const sinAprobar = tarea.estado === "EN_ESPERA" || tarea.estado === "RECHAZADO"

  const descargarConstancia = async () => {
    setDescargando(true);
    setDescargaError(null);
    try {
      const blob = await apiFetchBlob(
        `/api/tasks/tasks/${tarea.id}/constancia/`
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `constancia-${tarea.ticket ?? tarea.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDescargaError((e as Error).message);
    } finally {
      setDescargando(false);
    }
  };

  const refrescar = () => {
    setAccion(null);
    void onRefresh();
  };

  const puedeCancelar = tarea.puede_cancelar ?? false;
  const puedeAgregarInfo = tarea.puede_agregar_informacion ?? false;
  const puedeConfirmar = tarea.puede_confirmar_solucion ?? false;
  const puedeReabrir = tarea.puede_reabrir ?? false;

  const acciones = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "0 22px 16px",
      }}
    >
      {puedeAgregarInfo && (
        <button
          type="button"
          onClick={() => setAccion("informacion")}
          style={accionBtn}
        >
          + Agregar información
        </button>
      )}
      {puedeConfirmar && (
        <button
          type="button"
          onClick={() => setAccion("confirmar")}
          style={{ ...accionBtn, background: "var(--color-done)", color: "var(--color-on-accent)", borderColor: "var(--color-done)" }}
        >
          Confirmar solución
        </button>
      )}
      {puedeReabrir && (
        <button
          type="button"
          onClick={() => setAccion("reabrir")}
          style={{ ...accionBtn, color: "var(--color-waiting)", borderColor: "var(--color-waiting)" }}
        >
          Reabrir solicitud
        </button>
      )}
      <button
        type="button"
        onClick={() => void descargarConstancia()}
        disabled={descargando}
        style={accionBtn}
      >
        {descargando ? "Generando PDF…" : "Descargar constancia PDF"}
      </button>
      {puedeCancelar && (
        <button
          type="button"
          onClick={() => setAccion("cancelar")}
          style={{ ...accionBtn, color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
        >
          Cancelar solicitud
        </button>
      )}
      {descargaError && (
        <span style={{ fontSize: 12, color: "var(--color-danger)", alignSelf: "center" }}>
          {descargaError}
        </span>
      )}
    </div>
  );

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
        {acciones}
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
              {(tarea.estado_explicado || tarea.siguiente_paso || tarea.motivo_demora) && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    background: "var(--color-surface)",
                    padding: "12px 14px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13 }}>Estado actual</strong>
                    <TaskStatusBadge estado={tarea.estado} compact />
                  </div>
                  {tarea.estado_explicado && (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)" }}>
                      {tarea.estado_explicado}
                    </p>
                  )}
                  {tarea.siguiente_paso && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                      <strong style={{ color: "var(--color-text)" }}>Siguiente paso:</strong>{" "}
                      {tarea.siguiente_paso}
                    </p>
                  )}
                  {tarea.motivo_demora && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-waiting)" }}>
                      <strong>Motivo:</strong> {tarea.motivo_demora}
                    </p>
                  )}
                  {tarea.equipo_lider_nombre && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                      Responsable del equipo: <strong>{tarea.equipo_lider_nombre}</strong>
                    </p>
                  )}
                  {tarea.fecha_limite_confirmacion &&
                    tarea.confirmacion_cliente === "PENDIENTE" && (
                      <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Confirma o reabre antes del{" "}
                        <strong>{fmt(tarea.fecha_limite_confirmacion)}</strong>.
                      </p>
                    )}
                </div>
              )}
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
                <RichTextView
                  html={tarea.descripcion}
                  className={styles.descriptionBox}
                />

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

      {accion === "cancelar" && (
        <CancelarSolicitudModal
          tarea={tarea}
          onClose={() => setAccion(null)}
          onCancelled={refrescar}
        />
      )}
      {accion === "informacion" && (
        <AgregarInformacionModal
          tarea={tarea}
          onClose={() => setAccion(null)}
          onSaved={refrescar}
        />
      )}
      {accion === "confirmar" && (
        <ConfirmarSolucionModal
          tarea={tarea}
          onClose={() => setAccion(null)}
          onSaved={refrescar}
        />
      )}
      {accion === "reabrir" && (
        <ReabrirSolicitudModal
          tarea={tarea}
          onClose={() => setAccion(null)}
          onSaved={refrescar}
        />
      )}
    </div >
  );
}
