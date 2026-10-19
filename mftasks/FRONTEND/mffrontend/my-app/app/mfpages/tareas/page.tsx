"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import TaskFilters from "@/components/tareas/TaskFilters";
import { useTasksWebSocket } from "@/app/providers/TasksWebSocketProvider";
import { useTareas } from "./hooks/useTareas";
import { rangoFechasPorDefecto } from "./utils/tareasFilters";
import type { CampoFecha, EstadoFiltro, FiltrosTareas } from "@/lib/services/tareasService";
import styles from "./Tareas.module.css";

const FILTROS_STORAGE_KEY = "mftasks:tareas:filtros";

type FiltrosGuardados = {
  busqueda: string;
  estado: EstadoFiltro;
  campoFecha: CampoFecha;
  desde: string;
  hasta: string;
  campana: number | "";
  subcampana: number | "";
};

export default function TareasPage() {
  const { eventos, subtareaEventos, observarTarea, dejarDeObservarTarea } = useTasksWebSocket();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>("EN_PROCESO");
  const [campoFecha, setCampoFecha] = useState<CampoFecha>("solicitud");
  const rangoInicial = useMemo(() => rangoFechasPorDefecto(), []);
  const [desde, setDesde] = useState(rangoInicial.desde);
  const [hasta, setHasta] = useState(rangoInicial.hasta);
  const [filtroCampana, setFiltroCampana] = useState<number | "">("");
  const [filtroSubcampana, setFiltroSubcampana] = useState<number | "">("");
  const primeraPersistencia = useRef(true);

  const filtros = useMemo<FiltrosTareas>(
    () => ({ busqueda, estado: filtroEstado, campoFecha, desde, hasta, campana: filtroCampana, subcampana: filtroSubcampana }),
    [busqueda, filtroEstado, campoFecha, desde, hasta, filtroCampana, filtroSubcampana]
  );
  const { tareas, cargando, error, cargar, setTareas } = useTareas(filtros);

  // Restaura los filtros al volver del detalle de una solicitud.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTROS_STORAGE_KEY);
      if (!raw) return;
      const guardados = JSON.parse(raw) as Partial<FiltrosGuardados>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (typeof guardados.busqueda === "string") setBusqueda(guardados.busqueda);
      if (guardados.estado) setFiltroEstado(guardados.estado);
      if (guardados.campoFecha) setCampoFecha(guardados.campoFecha);
      if (typeof guardados.desde === "string") setDesde(guardados.desde);
      if (typeof guardados.hasta === "string") setHasta(guardados.hasta);
      if (typeof guardados.campana === "number" || guardados.campana === "") setFiltroCampana(guardados.campana);
      if (typeof guardados.subcampana === "number" || guardados.subcampana === "") setFiltroSubcampana(guardados.subcampana);
    } catch {
      // Si el almacenamiento no está disponible, se usan los filtros por defecto.
    }
  }, []);

  useEffect(() => {
    if (primeraPersistencia.current) {
      primeraPersistencia.current = false;
      return;
    }
    try {
      const guardados: FiltrosGuardados = {
        busqueda,
        estado: filtroEstado,
        campoFecha,
        desde,
        hasta,
        campana: filtroCampana,
        subcampana: filtroSubcampana,
      };
      sessionStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify(guardados));
    } catch {
      // Sin persistencia si sessionStorage no está disponible.
    }
  }, [busqueda, filtroEstado, campoFecha, desde, hasta, filtroCampana, filtroSubcampana]);

  const idsTareas = useMemo(() => tareas.map((t) => t.id), [tareas]);

  const rangoDefecto = rangoFechasPorDefecto();
  const hayFiltros =
    filtroEstado !== "TODOS" ||
    !!busqueda ||
    desde !== rangoDefecto.desde ||
    hasta !== rangoDefecto.hasta ||
    filtroCampana !== "" ||
    filtroSubcampana !== "";

  const limpiarFiltros = () => {
    const r = rangoFechasPorDefecto();
    setFiltroEstado("EN_PROCESO");
    setCampoFecha("solicitud");
    setDesde(r.desde);
    setHasta(r.hasta);
    setBusqueda("");
    setFiltroCampana("");
    setFiltroSubcampana("");
    cargar({ busqueda: "", estado: "EN_PROCESO", campoFecha: "solicitud", desde: r.desde, hasta: r.hasta, campana: "", subcampana: "" });
  };

  const aplicarRangoPorDefecto = () => {
    const r = rangoFechasPorDefecto();
    setDesde(r.desde);
    setHasta(r.hasta);
  };

  const handleEstadoChange = (estado: EstadoFiltro) => {
    setFiltroEstado(estado);
    aplicarRangoPorDefecto();
  };

  useEffect(() => {
    idsTareas.forEach((id) => observarTarea(id));

    return () => {
      idsTareas.forEach((id) => dejarDeObservarTarea(id));
    };
  }, [idsTareas, observarTarea, dejarDeObservarTarea]);

  useEffect(() => {
    if (
      Object.keys(eventos).length === 0 &&
      Object.keys(subtareaEventos).length === 0
    ) {
      return;
    }

    setTareas((actuales) =>
      actuales.map((tarea) => {
        const evento = eventos[tarea.id];

        let actualizada = tarea;

        if (evento && evento.type === "task_status_changed") {
          actualizada = {
            ...actualizada,
            estado: evento.estado_nuevo
              ? String(evento.estado_nuevo)
              : actualizada.estado,
            progreso:
              typeof evento.progreso === "number"
                ? String(evento.progreso)
                : actualizada.progreso,
            activo:
              typeof evento.activo === "boolean"
                ? evento.activo
                : actualizada.activo,
          };
        }

        if (actualizada.subtareas?.length) {
          actualizada = {
            ...actualizada,
            subtareas: actualizada.subtareas.map((s) => {
              const eventoSub = subtareaEventos[s.id];

              if (!eventoSub || eventoSub.type !== "subtask_status_changed") {
                return s;
              }

              return {
                ...s,
                estado: eventoSub.estado_nuevo
                  ? String(eventoSub.estado_nuevo)
                  : s.estado,
                activo:
                  typeof eventoSub.activo === "boolean"
                    ? eventoSub.activo
                    : s.activo,
              };
            }),
          };
        }

        return actualizada;
      })
    );
  }, [eventos, subtareaEventos, setTareas]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    cargar({ busqueda });
  };

  const mostrarCargando = cargando && tareas.length === 0;
  const mostrarError = !!error && tareas.length === 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Solicitudes activas</p>
          <h2 className={styles.title}>Tareas en desarrollo</h2>
          <p className={styles.subtitle}>Seguimiento de solicitudes, subtareas, dependencias y tiempos de entrega.</p>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.resultCount} aria-live="polite">
            {tareas.length} resultado{tareas.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <TaskFilters
        campanaId={filtroCampana}
        subcampanaId={filtroSubcampana}
        onCampanaChange={({ campanaId, subcampanaId }) => {
          setFiltroCampana(campanaId);
          setFiltroSubcampana(subcampanaId);
        }}
        estado={filtroEstado}
        onEstadoChange={handleEstadoChange}
        campoFecha={campoFecha}
        onCampoFechaChange={setCampoFecha}
        desde={desde}
        onDesdeChange={setDesde}
        hasta={hasta}
        onHastaChange={setHasta}
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        onBuscar={handleBuscar}
        onLimpiar={limpiarFiltros}
        hayFiltros={hayFiltros}
      />

      {error && tareas.length > 0 && (
        <div className={styles.inlineError} role="alert">
          {error}
        </div>
      )}

      {mostrarCargando ? (
        <div className={styles.loadingPanel} aria-label="Cargando tareas">
          <span className={styles.srOnly}>Cargando tareas…</span>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      ) : mostrarError ? (
        <div className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
          <div>
            <strong>No se pudieron cargar las tareas</strong>
            <p>{error}</p>
            <button type="button" className={styles.retryButton} onClick={() => cargar()}>
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <TaskTableEnDesarrollo tareas={tareas} />
      )}
    </div>
  );
}
