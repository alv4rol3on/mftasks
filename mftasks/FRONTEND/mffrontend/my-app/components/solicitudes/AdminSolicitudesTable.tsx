"use client";

import { useState, useMemo, useEffect } from "react";
import { Task } from "@/lib/types";
import TaskModal from "@/components/tareas/TaskModal";
import Pagination from "@/components/ui/Pagination";
import IconButton from "@/components/ui/IconButton";
import styles from "@/components/shared/SharedTable.module.css";
import { ContadoresProvider, useContador } from "@/components/tareas/ContadoresProvider";
import TaskStatusBadge from "@/components/tareas/TaskStatusBadge";
import CancelarSolicitudModal from "@/components/solicitudes/CancelarSolicitudModal";
import { useToast } from "@/components/ui/Toast";

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

function EstadoCell({ tarea }: { tarea: Task }) {
  const contador = useContador(tarea.id);
  const fueraDeTiempo = tarea.estado === "EN_DESARROLLO" && !!contador?.con_retraso;
  return <TaskStatusBadge estado={tarea.estado} fueraDeTiempo={fueraDeTiempo} compact />;
}

type Props = {
  tareas: Task[];
  onReload: () => void;
};

const ESTADOS_CANCELABLES = new Set([
  "EN_ESPERA",
  "APROBADO",
  "EN_DESARROLLO",
  "STAND_BY",
]);

export default function AdminSolicitudesTable({ tareas, onReload }: Props) {
  const [selected, setSelected] = useState<Task | null>(null);
  const [cancelando, setCancelando] = useState<Task | null>(null);
  const [pagina, setPagina] = useState(1);
  const pageSize = 10;
  const { showToast } = useToast();

  const totalPages = Math.max(1, Math.ceil(tareas.length / pageSize));
  const paginaClamped = Math.min(pagina, totalPages);
  const paginadas = useMemo(() => tareas.slice((paginaClamped - 1) * pageSize, paginaClamped * pageSize), [tareas, paginaClamped]);

  const visibleIds = useMemo(() => paginadas.map((t) => t.id), [paginadas]);
  const refreshKey = useMemo(
    () =>
      paginadas
        .map(
          (t) =>
            `${t.id}:${t.estado}:${t.fecha_entrega_aproximada ?? ""}:${(t.subtareas ?? [])
              .map((s) => `${s.id}:${s.estado}`)
              .join(",")}`
        )
        .join("|"),
    [paginadas]
  );

  useEffect(() => setPagina(1), [tareas.length]);
  useEffect(() => { if (pagina > totalPages) setPagina(totalPages); }, [pagina, totalPages]);

  return (
    <ContadoresProvider ids={visibleIds} refreshKey={refreshKey}>
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
                <th>Equipo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginadas.map((t) => {
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(t); } }}
                  >
                    <td data-label="Fecha solicitud" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtFecha(t.fecha_creacion)}</td>
                    <td data-label="Solicitud">
                      <div className={styles.taskSubject}>
                        {t.asunto}
                        <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>{t.ticket ?? `#${t.id}`}</span>
                      </div>
                    </td>
                    <td data-label="Estado">
                      <EstadoCell tarea={t} />
                    </td>
                    {/*<td data-label="Solicitante" style={{ fontSize: 12 }}>{t.solicitante_nombre ?? "-"}</td>*/}
                    <td data-label="Equipo" style={{ fontSize: 12 }}>{t.equipo_nombre}</td>
                    <td data-label="Acciones" style={{ whiteSpace: "nowrap" }}>
                      {t.estado === "CANCELADO" ? (
                        "-"
                      ) : ESTADOS_CANCELABLES.has(t.estado) ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              icon="trash"
                              variant="danger"
                              title="Cancelar solicitud"
                              onClick={() => setCancelando(t)}
                            />
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
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
      {cancelando && (
        <CancelarSolicitudModal
          tarea={cancelando}
          onClose={() => setCancelando(null)}
          onCancelled={() => {
            showToast("Solicitud cancelada", "success");
            setSelected(null);
            onReload();
          }}
        />
      )}
    </ContadoresProvider>
  );
}
