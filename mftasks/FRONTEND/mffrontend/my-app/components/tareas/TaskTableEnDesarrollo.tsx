"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./TaskTableEnDesarrollo.module.css";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import TaskCountdown from "./TaskCountdown";
import TaskStatusBadge from "./TaskStatusBadge";
import Pagination from "../ui/Pagination";
import { ContadoresProvider, useContador } from "./ContadoresProvider";
import { crearSegmentoTarea } from "@/lib/tareaUrl";

const fmtSolicitud = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtFecha = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatearFechaSolicitud(fecha: string | null | undefined): string {
  if (!fecha) return "-";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "-";
  return fmtSolicitud.format(d).replace(",", "");
}

function formatearFechaEntrega(fecha: string | null | undefined): string {
  if (!fecha) return "Sin fecha";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "Sin fecha";
  return fmtFecha.format(d);
}

function ProgresoTarea({ tarea }: { tarea: Task }) {
  const activas = (tarea.subtareas ?? []).filter((s) => s.activo !== false);
  const total = activas.length;
  const solucionadas = activas.filter((s) => s.estado === "SOLUCIONADO").length;
  const porcentaje = Math.max(0, Math.min(100, Math.round(Number(tarea.progreso) || 0)));

  return (
    <div className={styles.progress}>
      <div className={styles.progressTop}>
        <span className={styles.progressValue}>{porcentaje}%</span>
        <span className={styles.progressMeta}>
          {total === 0 ? "Sin subtareas" : `${solucionadas} de ${total} subtareas`}
        </span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={`Progreso de ${tarea.ticket ?? `la tarea ${tarea.id}`}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
      >
        <span
          className={`${tarea.estado === "CANCELADO" ? styles.progressBarCancelado : styles.progressBar } ${porcentaje === 100 ? styles.progressBarDone : ""}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

function FilaTarea({
  tarea,
  conPendiente,
  onSelect,
}: {
  tarea: Task;
  conPendiente: boolean;
  onSelect: (tarea: Task) => void;
}) {
  const contador = useContador(tarea.id);
  const fueraDeTiempo = tarea.estado === "EN_DESARROLLO" && !!contador?.con_retraso;

  const rowClass = [
    styles.taskRow,
    tarea.estado === "SOLUCIONADO" ? styles.rowSolucionado : "",
    tarea.estado === "STAND_BY" ? styles.rowStandBy : "",
    fueraDeTiempo ? styles.rowFueraDeTiempo : "",
    conPendiente ? styles.rowPendiente : "",
  ].filter(Boolean).join(" ");

  const mostrarContador = tarea.estado !== "APROBADO" && tarea.estado !== "RECHAZADO" && tarea.estado !== "CANCELADO";

  return (
    <tr
      className={rowClass}
      onClick={() => onSelect(tarea)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(tarea);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalles de ${tarea.asunto}`}
      title={
        fueraDeTiempo
          ? "Tarea fuera de tiempo — clic para ver detalles"
          : conPendiente
            ? "Tienes subtareas pendientes — clic para ver detalles"
            : tarea.estado === "SOLUCIONADO"
              ? "Tarea solucionada — clic para ver detalles"
              : "Clic para ver detalles"
      }
    >
      <td data-label="Fecha solicitud" data-col="fecha" className={styles.dateCell}>
        {formatearFechaSolicitud(tarea.fecha_creacion)}
      </td>

      <td data-label="Solicitud" className={styles.subjectCell}>
        <span className={styles.subjectTitle}>
          {tarea.subcampana_nombre
            ? `${tarea.campana_nombre}-${tarea.subcampana_nombre}: ${tarea.asunto}`
            : `${tarea.campana_nombre ?? "-"}: ${tarea.asunto}`}
        </span>
        <span className={styles.subjectMeta}>
          <span className={styles.ticket}>{tarea.ticket ?? `#${tarea.id}`}</span>
          {tarea.campana_nombre && <span>{tarea.campana_nombre}{tarea.subcampana_nombre ? ` / ${tarea.subcampana_nombre}` : ""}</span>}
        </span>
        {conPendiente && (
          <span className={styles.pendingNote}>Tienes subtareas pendientes por completar</span>
        )}
      </td>

      <td data-label="Equipo" data-col="equipo" className={styles.teamCell}>
        {tarea.equipo_nombre || "Sin equipo"}
      </td>

      <td data-label="Estado" data-col="estado">
        <TaskStatusBadge estado={tarea.estado} fueraDeTiempo={fueraDeTiempo} />
      </td>

      <td data-label="Entrega / tiempo" data-col="entrega" className={styles.deliveryCell}>
       {tarea.estado === "SOLUCIONADO" ?(
        <span className={styles.deliveryDate}>Solucionado: {formatearFechaEntrega(tarea.fecha_solucion)}</span>
       ):
       tarea.estado === "CANCELADO" ?(
        <span className={styles.deliveryDate}>-</span>
       ):
       (
        <span className={styles.deliveryDate}>Entrega aprox: {formatearFechaEntrega(tarea.fecha_entrega_aproximada)}</span>
       )}
        <span className={styles.counter}>
          {tarea.estado === "APROBADO"
            ? "Por asignar"
            : tarea.estado === "RECHAZADO"
              ? "Rechazado"
              : mostrarContador
                ? <TaskCountdown tareaId={tarea.id} />
                : null}
        </span>
      </td>

      <td data-label="Progreso" data-col="progreso">
        <ProgresoTarea tarea={tarea} />
      </td>
    </tr>
  );
}

export default function TaskTableEnDesarrollo({
  tareas,
}: {
  tareas: Task[];
}) {
  const router = useRouter();
  const abrirTarea = (tarea: Task) => {
    const segmento = crearSegmentoTarea(tarea.asunto, tarea.id);
    router.push(`/mfpages/tareas/${segmento}`);
  };
  const usuario = getUsuarioActual();
  const tienePendienteEnTarea = (tarea: Task) =>
    tarea.subtareas.some(
      (s) => s.activo !== false && s.asignado === usuario?.id && (s.estado === "EN_ESPERA" || s.estado === "EN_DESARROLLO")
    );

  const tareasVisibles = tareas.filter((tarea) => tarea.estado !== "EN_ESPERA");

  const tareasOrdenadas = useMemo(
    () => [...tareasVisibles].sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()),
    [tareasVisibles]
  );

  const pageSize = 10;
  const [pagina, setPagina] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tareasOrdenadas.length / pageSize));
  const paginaClamped = Math.min(pagina, totalPages);
  const tareasPaginadas = useMemo(
    () => tareasOrdenadas.slice((paginaClamped - 1) * pageSize, paginaClamped * pageSize),
    [tareasOrdenadas, paginaClamped]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPagina(1);
  }, [tareas.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pagina > totalPages) setPagina(totalPages);
  }, [pagina, totalPages]);

  const visibleIds = useMemo(() => tareasPaginadas.map((t) => t.id), [tareasPaginadas]);

  const refreshKey = useMemo(
    () =>
      tareasVisibles
        .map(
          (t) =>
            `${t.id}:${t.estado}:${t.progreso}:${t.fecha_entrega_aproximada ?? ""}:${(t.subtareas ?? [])
              .map((s) => `${s.id}:${s.estado}`)
              .join(",")}`
        )
        .join("|"),
    [tareasVisibles]
  );

  return (
    <ContadoresProvider ids={visibleIds} refreshKey={refreshKey}>
      <div className={styles.tableCard}>
        {tareasVisibles.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No se encontraron solicitudes</strong>
            <p>Ajusta los filtros o revisa las solicitudes activas del equipo.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.taskTable}>
              <caption className={styles.srOnly}>Solicitudes activas con su estado, entrega y progreso</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha solicitud</th>
                  <th scope="col">Solicitud</th>
                  <th scope="col" data-col="equipo">Equipo</th>
                  <th scope="col" data-col="estado">Estado</th>
                  <th scope="col" data-col="entrega">Entrega / tiempo</th>
                  <th scope="col" data-col="progreso">Progreso</th>
                </tr>
              </thead>
              <tbody>
                {tareasPaginadas.map((tarea) => (
                  <FilaTarea
                    key={tarea.id}
                    tarea={tarea}
                    conPendiente={tienePendienteEnTarea(tarea)}
                    onSelect={abrirTarea}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tareasOrdenadas.length > 0 && (
        <div className={styles.paginationWrap}>
          <Pagination page={paginaClamped} totalPages={totalPages} totalItems={tareasOrdenadas.length} pageSize={pageSize} onPageChange={setPagina} />
        </div>
      )}
    </ContadoresProvider>
  );
}
