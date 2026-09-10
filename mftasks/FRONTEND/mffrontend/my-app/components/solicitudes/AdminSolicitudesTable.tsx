"use client";

import { useState, useMemo, useEffect } from "react";
import { Task } from "@/lib/types";
import TaskModal from "@/components/tareas/TaskModal";
import Pagination from "@/components/ui/Pagination";
import styles from "@/components/shared/SharedTable.module.css";
import { apiFetch } from "@/lib/api";

const fmt = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function fmtFecha(f: string | null | undefined) {
  if (!f) return "-";
  const d = new Date(f);
  if (isNaN(d.getTime())) return "-";
  return fmt.format(d).replace(",", "");
}
function badge(estado: string) {
  const m: Record<string, any> = {
    EN_ESPERA: { bg: "#e5e7eb", color: "#1f2937", border: "#9ca3af", label: "EN ESPERA" },
    APROBADO: { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe", label: "APROBADO" },
    EN_DESARROLLO: { bg: "#dbeafe", color: "#1e3a8a", border: "#2563eb", label: "EN DESARROLLO" },
    STAND_BY: { bg: "#fef3c7", color: "#78350f", border: "#d97706", label: "STAND BY" },
    SOLUCIONADO: { bg: "#dcfce7", color: "#14532d", border: "#16a34a", label: "SOLUCIONADO" },
    RECHAZADO: { bg: "#fee2e2", color: "#991b1b", border: "#fecaca", label: "RECHAZADO" },
  };
  return m[estado] ?? { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb", label: estado };
}

type Props = {
  tareas: Task[];
  onReload: () => void;
};

export default function AdminSolicitudesTable({ tareas, onReload }: Props) {
  const [selected, setSelected] = useState<Task | null>(null);
  const [pagina, setPagina] = useState(1);
  const pageSize = 10;
  const [inactivando, setInactivando] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(tareas.length / pageSize));
  const paginaClamped = Math.min(pagina, totalPages);
  const paginadas = useMemo(() => tareas.slice((paginaClamped - 1) * pageSize, paginaClamped * pageSize), [tareas, paginaClamped]);

  useEffect(() => setPagina(1), [tareas.length]);
  useEffect(() => { if (pagina > totalPages) setPagina(totalPages); }, [pagina, totalPages]);

  const inactivar = async (t: Task) => {
    const ok = confirm(`¿Inactivar solicitud ${t.ticket ?? "#" + t.id} - "${t.asunto}"? Quedará marcada como inactiva.`);
    if (!ok) return;
    setInactivando(t.id);
    try {
      await apiFetch(`/api/tasks/tasks/${t.id}/inactivar/`, { method: "POST" });
      onReload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setInactivando(null);
    }
  };
  const reactivar = async (t: Task) => {
    setInactivando(t.id);
    try {
      await apiFetch(`/api/tasks/tasks/${t.id}/reactivar/`, { method: "POST" });
      onReload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setInactivando(null);
    }
  };

  return (
    <>
      <div className={styles.taskTableContainer}>
        {tareas.length === 0 ? (
          <div className={styles.noTasks}>No hay solicitudes con ese filtro</div>
        ) : (
          <table className={styles.taskTable}>
            <thead>
              <tr>
                <th>Fecha solicitud</th>
                <th>Solicitud</th>
                <th>Estado</th>
                <th>Solicitante</th>
                <th>Equipo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginadas.map((t) => {
                const b = badge(t.estado);
                const inactiva = (t as any).activo === false;
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(t); } }}
                    style={inactiva ? { opacity: 0.6 } : undefined}
                    title={inactiva ? "Inactiva" : undefined}
                  >
                    <td data-label="Fecha solicitud" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtFecha(t.fecha_creacion)}</td>
                    <td data-label="Solicitud">
                      <div className={styles.taskSubject}>
                        {t.campana_nombre ?? "-"} {t.subcampana_nombre ? `- ${t.subcampana_nombre}` : ""}: {t.asunto}
                        <span style={{ display: "block", fontSize: 11, color: "#6b7280", fontWeight: 400 }}>{t.ticket ?? `#${t.id}`}{inactiva && <span style={{ marginLeft: 6, background: "#fee2e2", color: "#991b1b", padding: "1px 6px", borderRadius: 6, fontSize: 10 }}>Inactiva</span>}</span>
                      </div>
                    </td>
                    <td data-label="Estado">
                      <span style={{ display: "inline-flex", alignItems: "center", background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{b.label}</span>
                    </td>
                    <td data-label="Solicitante" style={{ fontSize: 12 }}>{t.solicitante_nombre ?? "-"}</td>
                    <td data-label="Equipo" style={{ fontSize: 12 }}>{t.equipo_nombre}</td>
                    <td data-label="Acciones" style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                          className={styles.btnDetalles}
                          style={{ padding: "6px 10px", fontSize: 11 }}
                        >
                          Ver
                        </button>
                        {!inactiva ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); inactivar(t); }}
                            disabled={inactivando === t.id}
                            style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                          >
                            {inactivando === t.id ? "..." : "Inactivar"}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); reactivar(t); }}
                            disabled={inactivando === t.id}
                            style={{ background: "#16a34a", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                          >
                            {inactivando === t.id ? "..." : "Reactivar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {tareas.length > 0 && <Pagination page={paginaClamped} totalPages={totalPages} totalItems={tareas.length} pageSize={pageSize} onPageChange={setPagina} />}
      <TaskModal tarea={selected} onClose={() => setSelected(null)} onTareaMutated={onReload} />
    </>
  );
}
