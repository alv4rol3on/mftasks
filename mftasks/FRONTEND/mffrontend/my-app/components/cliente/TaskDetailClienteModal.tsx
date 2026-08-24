"use client";
import { Task } from "@/lib/types";
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
  EN_ESPERA: "#f59e0b",
  APROBADO: "#2563eb",
  EN_DESARROLLO: "#7c3aed",
  RECHAZADO: "#dc2626",
  SOLUCIONADO: "#16a34a",
};

type Props = { tarea: Task | null; onClose: () => void };

export default function TaskDetailClienteModal({ tarea, onClose }: Props) {
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
          <div className={styles.modalColumn}>
            <h3>Información</h3>
            <table className={styles.infoTable}>
              <tbody>
                <tr><td><strong>Cliente</strong></td><td>{tarea.cliente_nombre}</td></tr>
                <tr><td><strong>Equipo</strong></td><td>{tarea.equipo_nombre}</td></tr>
                <tr><td><strong>Estado</strong></td><td>{tarea.estado}</td></tr>
                {tarea.motivo_rechazo && <tr><td><strong>Motivo rechazo</strong></td><td>{tarea.motivo_rechazo}</td></tr>}
                <tr><td><strong>Fecha solicitud</strong></td><td>{fmt(tarea.fecha_creacion)}</td></tr>
                <tr><td><strong>Fecha inicio</strong></td><td>{fmt(tarea.fecha_inicio)}</td></tr>
                <tr><td><strong>Entrega aprox.</strong></td><td>{fmt(tarea.fecha_entrega_aproximada)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className={styles.modalColumn}>
            <h3>Descripción</h3>
            <div className={styles.descriptionBox}>{tarea.descripcion}</div>
          </div>
          <div className={styles.progresoSection}>
            <h3>Progreso — {progresoNum.toFixed(2)}%</h3>
            <div style={{ background: "#e5e7eb", borderRadius: 8, height: 14, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: `${Math.min(100, progresoNum)}%`, background: progresoNum === 100 ? "#16a34a" : "#2563eb", height: "100%", transition: "width .3s" }} />
            </div>
            {tarea.subtareas.length === 0 ? (
              <p className={styles.sinSubtareas}>
                {tarea.estado === "EN_ESPERA" ? "Tu solicitud está en espera de aprobación." : tarea.estado === "RECHAZADO" ? "Solicitud rechazada." : "Aprobada, en asignación de tareas."}
              </p>
            ) : (
              <div className={styles.subtareasContainer}>
                <table className={styles.subtareasTable}>
                  <thead><tr><th>Subtarea</th><th>Estado</th><th>Peso</th><th>Asignado</th></tr></thead>
                  <tbody>
                    {tarea.subtareas.map((s) => (
                      <tr key={s.id} className={s.estado === "SOLUCIONADO" ? styles.estadoSolucionado : s.estado === "EN_DESARROLLO" ? styles.estadoEnDesarrollo : styles.estadoEnEspera}>
                        <td>{s.descripcion}</td><td>{s.estado}</td><td>{s.peso}</td><td>{s.asignado_nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
