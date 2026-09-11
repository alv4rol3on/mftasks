"use client";

import { useState, useMemo, useEffect } from "react";
import { Task } from "@/lib/types";
import Pagination from "@/components/ui/Pagination";
import styles from "@/components/shared/SharedTable.module.css";

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
  onSelect: (t: Task) => void;
};

export default function ClienteSolicitudesTable({ tareas, onSelect }: Props) {
  const [pagina, setPagina] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(tareas.length / pageSize));
  const paginaClamped = Math.min(pagina, totalPages);
  const paginadas = useMemo(() => tareas.slice((paginaClamped - 1) * pageSize, paginaClamped * pageSize), [tareas, paginaClamped]);

  useEffect(() => setPagina(1), [tareas.length]);
  useEffect(() => { if (pagina > totalPages) setPagina(totalPages); }, [pagina, totalPages]);

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
                <th>Progreso</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginadas.map((t) => {
                const b = badge(t.estado);
                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelect(t)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(t); } }}
                  >
                    <td data-label="Fecha solicitud" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtFecha(t.fecha_creacion)}</td>
                    <td data-label="Solicitud">
                      <div className={styles.taskSubject}>
                        {t.campana_nombre ?? "-"} {t.subcampana_nombre ? `- ${t.subcampana_nombre}` : ""}: {t.asunto}
                        <span style={{ display: "block", fontSize: 11, color: "#6b7280", fontWeight: 400 }}>{t.ticket ?? `#${t.id}`} • {t.equipo_nombre}</span>
                      </div>
                    </td>
                    <td data-label="Estado">
                      <span style={{ display: "inline-flex", alignItems: "center", background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{b.label}</span>
                    </td>
                    <td data-label="Progreso" style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, color: "#1d3557" }}>
                      {parseFloat(String(t.progreso ?? 0)).toFixed(1)}%
                    </td>
                    <td data-label="Acción" style={{ whiteSpace: "nowrap" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelect(t); }}
                        className={styles.btnDetalles}
                        style={{ padding: "6px 10px", fontSize: 11 }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {tareas.length > 0 && <Pagination page={paginaClamped} totalPages={totalPages} totalItems={tareas.length} pageSize={pageSize} onPageChange={setPagina} />}
    </>
  );
}
