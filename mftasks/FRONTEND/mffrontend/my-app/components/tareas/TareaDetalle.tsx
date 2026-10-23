"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTareaDetalle } from "@/app/mfpages/tareas/hooks/useTareaDetalle";
import { useTareaAcciones } from "@/app/mfpages/tareas/hooks/useTareaAcciones";
import { getUsuarioActual } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { ContadoresProvider } from "@/components/tareas/ContadoresProvider";
import TaskCountdown from "@/components/tareas/TaskCountdown";
import TaskStatusBadge from "@/components/tareas/TaskStatusBadge";
import AdjuntosTarea from "@/components/adjuntos/AdjuntosTarea";
import RichTextView from "@/components/shared/RichTextView";
import SuccessModal from "@/components/shared/SuccessModal";
import HistorialTarea from "@/components/tareas/HistorialTarea";
import SubtaskBoard from "@/components/tareas/SubtaskBoard";
import AssignmentPanel from "@/components/tareas/AssignmentPanel";
import DependencyPanel from "@/components/tareas/DependencyPanel";
import SubtaskActionDialog from "@/components/tareas/SubtaskActionDialog";
import type { Subtarea } from "@/lib/types";
import styles from "./TareaDetalle.module.css";

type TabKey = "tablero" | "asignaciones" | "dependencias" | "historial";
type AccionPendiente = { tipo: "pausa" | "solucionar" | "reanudar"; subtarea: Subtarea } | null;

const formatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatearFecha = (fecha: string | null | undefined) => {
  if (!fecha) return "-";
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return "-";
  return formatter.format(date);
};

function bloqueadorasPendientes(subtarea: Subtarea) {
  return (subtarea.bloqueada_por ?? []).filter((b) => b.estado !== "SOLUCIONADO");
}

export default function TareaDetalle({
  tareaId,
  rutaTarea,
}: {
  tareaId: number | null;
  rutaTarea: string;
}) {
  const { tarea, cargando, error, cargar, refreshKey } = useTareaDetalle(tareaId);
  const { showToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("tablero");
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente>(null);
  const [descripcionExpandida, setDescripcionExpandida] = useState(false);
  const [solicitudResuelta, setSolicitudResuelta] = useState<{
    ticket: string | null;
    asunto: string;
  } | null>(null);
  const usuario = getUsuarioActual();
  const esAdmin = (usuario?.roles ?? []).map((r) => r.toLowerCase()).includes("administrador");
  const soloLectura = esAdmin;

  const acciones = useTareaAcciones({
    cargar,
    onSolicitudResuelta: (_id, res) => {
      if (!res?.solicitud_resuelta) return;
      setSolicitudResuelta({
        ticket: res.tarea_ticket ?? null,
        asunto: tarea?.asunto ?? "",
      });
    },
  });

  const volver = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/mfpages/tareas");
    }
  };

  const puedeMoverSubtarea = (subtarea: Subtarea) => {
    if (!tarea || soloLectura) return false;
    if (tarea.estado === "SOLUCIONADO" || tarea.estado === "RECHAZADO" || tarea.estado === "APROBADO") return false;
    if (subtarea.activo === false) return false;
    if (bloqueadorasPendientes(subtarea).length > 0) return false;
    return subtarea.asignado === usuario?.id;
  };

  const solicitarMovimiento = (subtarea: Subtarea, destino: string) => {
    if (!tarea) return;
    if (!puedeMoverSubtarea(subtarea)) {
      showToast("Solo el usuario asignado puede mover esta subtarea.", "error");
      return;
    }
    if (subtarea.estado === destino) return;

    const pendientes = bloqueadorasPendientes(subtarea);
    const bloqueada = pendientes.length > 0;

    if (destino === "EN_ESPERA") {
      showToast("No se puede volver a En espera una subtarea iniciada.", "error");
      return;
    }

    if (bloqueada && (destino === "EN_DESARROLLO" || destino === "SOLUCIONADO")) {
      showToast(
        `Bloqueada: primero debes solucionar ${pendientes.map((b) => b.descripcion).join(", ")}.`,
        "error"
      );
      return;
    }

    if (destino === "STAND_BY") {
      if (subtarea.estado !== "EN_ESPERA" && subtarea.estado !== "EN_DESARROLLO") {
        showToast("Solo se puede pausar desde En espera o En desarrollo.", "error");
        return;
      }
      setAccionPendiente({ tipo: "pausa", subtarea });
      return;
    }

    if (destino === "SOLUCIONADO") {
      if (subtarea.estado !== "EN_DESARROLLO") {
        showToast("Primero debes iniciar la subtarea antes de solucionarla.", "error");
        return;
      }
      setAccionPendiente({ tipo: "solucionar", subtarea });
      return;
    }

    if (destino === "EN_DESARROLLO") {
      if (subtarea.estado === "EN_ESPERA") {
        void acciones.empezarSubtarea(tarea.id, subtarea.id).catch(() => { });
        return;
      }
      if (subtarea.estado === "STAND_BY") {
        setAccionPendiente({ tipo: "reanudar", subtarea });
        return;
      }
      showToast("La subtarea ya está en desarrollo.", "error");
    }
  };

  const confirmarPausa = async (motivo: string) => {
    if (!tarea || accionPendiente?.tipo !== "pausa") return;
    await acciones.cambiarEstadoSubtarea(
      tarea.id,
      accionPendiente.subtarea.id,
      "STAND_BY",
      motivo,
      accionPendiente.subtarea.estado
    );
    setAccionPendiente(null);
  };

  const confirmarSolucion = async () => {
    if (!tarea || accionPendiente?.tipo !== "solucionar") return;
    await acciones.completarSubtarea(tarea.id, accionPendiente.subtarea.id);
    setAccionPendiente(null);
  };

  const confirmarReanudar = async (opts: { modo: "continuar" | "nueva_fecha" | "mantener"; nuevaFechaEntrega?: string }) => {
    if (!tarea || accionPendiente?.tipo !== "reanudar") return;
    await acciones.reanudarSubtarea(tarea.id, accionPendiente.subtarea.id, opts);
    setAccionPendiente(null);
  };

  if (tareaId === null) {
    return (
      <div className={styles.page}>
        <div className={styles.statePanel}>
          <strong>Solicitud no válida</strong>
          <p>La dirección no contiene un identificador de solicitud válido.</p>
          <button type="button" className={styles.secondaryButton} onClick={volver}>Volver a Tareas en desarrollo</button>
        </div>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingPanel} aria-label="Cargando solicitud">
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonGrid}>
            <div className={styles.skeletonBlock} />
            <div className={styles.skeletonBlock} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tarea) {
    return (
      <div className={styles.page}>
        <div className={`${styles.statePanel} ${styles.errorState}`} role="alert">
          <strong>No se pudo abrir la solicitud</strong>
          <p>{error ?? "La solicitud no existe o no tienes acceso a ella."}</p>
          <div className={styles.stateActions}>
            <button type="button" className={styles.secondaryButton} onClick={volver}>Volver</button>
            <button type="button" className={styles.primaryButton} onClick={() => void cargar()}>Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const subtareasActivas = tarea.subtareas.filter((s) => s.activo !== false);
  const subtareasInactivas = tarea.subtareas.length - subtareasActivas.length;
  const progreso = Math.max(0, Math.min(100, Math.round(Number(tarea.progreso) || 0)));
  const fueraDeTiempo = tarea.estado === "EN_DESARROLLO" && !!tarea.fuera_de_tiempo;
  const puedeVerAsignaciones = !soloLectura && !!tarea.puedo_operar && tarea.estado !== "APROBADO" && tarea.estado !== "SOLUCIONADO";
  const puedeIniciar = tarea.estado === "APROBADO" && !soloLectura && tarea.puedo_operar && tarea.subtareas.length === 0;
  const puedeOperarDependencias =
    !soloLectura &&
    !!tarea.puedo_operar &&
    tarea.estado !== "APROBADO" &&
    tarea.estado !== "SOLUCIONADO";
  const tabsDisponibles: { key: TabKey; label: string }[] = [
    { key: "tablero", label: "Tablero" },
    ...(puedeVerAsignaciones ? [{ key: "asignaciones" as TabKey, label: "Asignaciones" }] : []),
    { key: "dependencias", label: "Dependencias" },
    { key: "historial", label: "Historial" },
  ];
  const tabActual = tabsDisponibles.some((t) => t.key === tab) ? tab : "tablero";
  const enAprobado = tarea.estado === "APROBADO"

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const indice = tabsDisponibles.findIndex((t) => t.key === tabActual);
    if (indice < 0) return;

    let siguiente = indice;
    if (e.key === "ArrowRight") siguiente = (indice + 1) % tabsDisponibles.length;
    else if (e.key === "ArrowLeft") siguiente = (indice - 1 + tabsDisponibles.length) % tabsDisponibles.length;
    else if (e.key === "Home") siguiente = 0;
    else if (e.key === "End") siguiente = tabsDisponibles.length - 1;
    else return;

    e.preventDefault();
    const destino = tabsDisponibles[siguiente];
    setTab(destino.key);
    requestAnimationFrame(() => document.getElementById(`detalle-tab-${destino.key}`)?.focus());
  };

  return (
    <ContadoresProvider ids={[tarea.id]} refreshKey={refreshKey}>
      <div className={styles.page}>
        <button type="button" className={styles.backLink} onClick={volver}>
          ← Volver a Tareas en desarrollo
        </button>

        <header className={styles.detailHeader}>
          <div className={styles.headerMain}>
            <div className={styles.headerTopline}>
              <span className={styles.headerTicket}>{tarea.ticket ?? `Tarea #${tarea.id}`}</span>
              <TaskStatusBadge estado={tarea.estado} fueraDeTiempo={fueraDeTiempo} />
              {!fueraDeTiempo && tarea.estado === "SOLUCIONADO" && tarea.fecha_solucion && (
                <span className={styles.headerSolved}>Solucionada {formatearFecha(tarea.fecha_solucion)}</span>
              )}
            </div>
            <h2 className={styles.headerTitle}>{tarea.asunto}</h2>
            <div className={styles.headerMeta}>
              <span className={styles.headerTimer} title="Tiempo laboral restante o utilizado">
                {tarea.estado === "APROBADO"
                  ? "Aún no iniciada"
                  : tarea.estado === "RECHAZADO"
                    ? "Sin temporizador"
                    : tarea.estado === "SOLUCIONADO" && tarea.tiempo_tomado_formateado
                      ? `Tiempo laboral utilizado: ${tarea.tiempo_tomado_formateado}`
                      : <TaskCountdown tareaId={tarea.id} />}
              </span>
              {puedeIniciar && (
                <button
                  type="button"
                  className={styles.startButton}
                  onClick={() =>
                    router.push(`/mfpages/tareas/${rutaTarea}/iniciar`)
                  }
                >
                  Iniciar tarea
                </button>
              )}
            </div>
          </div>
          {soloLectura && <span className={styles.readonlyBadge}>Solo lectura</span>}
        </header>

        <div className={styles.overviewGrid}>
          <section className={styles.overviewCard} aria-labelledby="detalle-resumen">
            <h2 className={styles.cardTitle} id="detalle-resumen">Resumen</h2>
            <table className={styles.infoTable}>
              <tbody>
                <tr><td>Solicitante</td><td>{tarea.solicitante_nombre || "-"}</td></tr>
                <tr><td>Campaña</td><td>{tarea.campana_nombre ?? tarea.cliente_nombre ?? "-"}</td></tr>
                {tarea.subcampana_nombre && <tr><td>Subcampaña</td><td>{tarea.subcampana_nombre}</td></tr>}
                <tr><td>Equipo</td><td>{tarea.equipo_nombre || "-"}</td></tr>
                <tr><td>Fecha solicitud</td><td>{formatearFecha(tarea.fecha_creacion)}</td></tr>
                {tarea.fecha_inicio && <tr><td>Inicio</td><td>{formatearFecha(tarea.fecha_inicio)}</td></tr>}
                {tarea.fecha_entrega_aproximada ? (
                  <tr><td>Entrega</td><td>{formatearFecha(tarea.fecha_entrega_aproximada)}</td></tr>
                ) : (null)}

              </tbody>
            </table>
          </section>

          <section className={styles.overviewCard} aria-labelledby="detalle-descripcion">
            <h2 className={styles.cardTitle} id="detalle-descripcion">Descripción</h2>
            <div
              className={`${styles.descriptionBox} ${!descripcionExpandida ? styles.descriptionBoxCollapsed : ""
                }`}
            >
              <RichTextView html={tarea.descripcion} />
            </div>

            <button
              type="button"
              className={styles.descriptionToggle}
              onClick={() => setDescripcionExpandida((actual) => !actual)}
              aria-expanded={descripcionExpandida}
            >
              {descripcionExpandida ? "Ver menos ▲" : "Ver más ▼"}
            </button>
            <AdjuntosTarea archivos={tarea.archivos} tareaId={tarea.id} ticket={tarea.ticket} />
            {tarea.estado === "RECHAZADO" && tarea.motivo_rechazo && (
              <div className={styles.alertBox}>
                <strong>Motivo de rechazo</strong>
                <p>{tarea.motivo_rechazo}</p>
              </div>
            )}
            {subtareasInactivas > 0 && (
              <p className={styles.inactiveNote}>{subtareasInactivas} subtarea(s) inactivada(s).</p>
            )}
          </section>
        </div>
        {!enAprobado && (
          <section className={styles.workspace} aria-labelledby="detalle-trabajo">
            <div className={styles.workspaceTop}>
              <div>
                <h2 className={styles.workspaceTitle} id="detalle-trabajo">Progreso de la solicitud</h2>
              </div>
              <div className={styles.progressSummary}>
                <span className={styles.progressValue}>{progreso}%</span>
                <span className={styles.progressMeta}>
                  {subtareasActivas.length === 0
                    ? "Sin subtareas activas"
                    : `${subtareasActivas.filter((s) => s.estado === "SOLUCIONADO").length} de ${subtareasActivas.length} solucionadas`}
                </span>
              </div>
            </div>

            <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso} aria-label="Progreso de subtareas">
              <span className={styles.progressFill} style={{ width: `${progreso}%` }} />
            </div>

            <div className={styles.tabs} role="tablist" aria-label="Secciones de la solicitud">
              {tabsDisponibles.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`detalle-tab-${t.key}`}
                  aria-selected={tabActual === t.key}
                  aria-controls={`detalle-panel-${t.key}`}
                  tabIndex={tabActual === t.key ? 0 : -1}
                  className={tabActual === t.key ? styles.tabActive : styles.tab}
                  onClick={() => setTab(t.key)}
                  onKeyDown={handleTabKeyDown}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tabActual === "tablero" && (
              <div id="detalle-panel-tablero" role="tabpanel" aria-labelledby="detalle-tab-tablero" className={styles.tabPanel}>
                <SubtaskBoard
                  tarea={tarea}
                  puedeMover={puedeMoverSubtarea}
                  procesandoId={acciones.subtaskEnMovimiento}
                  onMove={solicitarMovimiento}
                />
              </div>
            )}

            {tabActual === "asignaciones" && (
              <div id="detalle-panel-asignaciones" role="tabpanel" aria-labelledby="detalle-tab-asignaciones" className={styles.tabPanel}>
                <AssignmentPanel
                  tarea={tarea}
                  puedeOperar={!soloLectura && !!tarea.puedo_operar}
                  onReasignarSubtarea={acciones.reasignarSubtarea}
                  onInactivarSubtarea={acciones.inactivarSubtarea}
                  onReactivarSubtarea={acciones.reactivarSubtarea}
                  onTareaMutated={cargar}
                />
              </div>
            )}

            {tabActual === "dependencias" && (
              <div id="detalle-panel-dependencias" role="tabpanel" aria-labelledby="detalle-tab-dependencias" className={styles.tabPanel}>
                <DependencyPanel
                  tarea={tarea}
                  puedeOperar={puedeOperarDependencias}
                  onTareaMutated={cargar}
                />
              </div>
            )}

            {tabActual === "historial" && (
              <div id="detalle-panel-historial" role="tabpanel" aria-labelledby="detalle-tab-historial" className={styles.tabPanel}>
                <HistorialTarea tareaId={tarea.id} />
              </div>
            )}
          </section>
        )}

      </div>

      {accionPendiente && (
        <SubtaskActionDialog
          tipo={accionPendiente.tipo}
          subtarea={accionPendiente.subtarea}
          tarea={tarea}
          procesando={acciones.subtaskEnMovimiento === accionPendiente.subtarea.id}
          onClose={() => setAccionPendiente(null)}
          onPausa={confirmarPausa}
          onSolucionar={confirmarSolucion}
          onReanudar={confirmarReanudar}
        />
      )}

      {solicitudResuelta && (
        <SuccessModal
          title="¡Solicitud solucionada exitosamente!"
          ticket={solicitudResuelta.ticket}
          asunto={solicitudResuelta.asunto}
          onClose={() => setSolicitudResuelta(null)}
        />
      )}
    </ContadoresProvider>
  );
}
