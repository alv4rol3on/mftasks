"use client";

import { useState, useMemo, useEffect } from "react";
import { Task } from "@/lib/types";
import Pagination from "@/components/ui/Pagination";
import IconButton from "@/components/ui/IconButton";
import styles from "@/components/shared/SharedTable.module.css";
import TaskStatusBadge from "@/components/tareas/TaskStatusBadge";

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
                        {t.entidad_nombre ?? "-"} ? {t.campana_nombre ?? "-"} {t.subcampana_nombre ? `? ${t.subcampana_nombre}` : ""}: {t.asunto}
                        <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>{t.ticket ?? `#${t.id}`} • {t.equipo_nombre}</span>
                      </div>
                    </td>
                    <td data-label="Estado">
                      <TaskStatusBadge estado={t.estado} compact />
                    </td>
                    <td data-label="Progreso" style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
                      {parseFloat(String(t.progreso ?? 0)).toFixed(1)}%
                    </td>
                    <td data-label="Acción" style={{ whiteSpace: "nowrap" }}>
                      <IconButton
                        icon="eye"
                        variant="info"
                        title="Ver detalle"
                        onClick={() => onSelect(t)}
                      />
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
