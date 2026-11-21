"use client";

import { useEffect, useMemo, useState } from "react";
import TaskTableEnDesarrollo from "@/components/tareas/TaskTableEnDesarrollo";
import TaskFilters from "@/components/tareas/TaskFilters";
import { useTasksWebSocket } from "@/app/providers/TasksWebSocketProvider";
import { useTareas } from "./hooks/useTareas";
import { rangoFechasPorDefecto } from "./utils/tareasFilters";
import { estadoIgnoraRangoFechas } from "@/lib/services/tareasService";
import { getUsuarioActual } from "@/lib/auth";
import {
  clavePersistencia,
  guardarJson,
  leerJson,
  limpiarPersistenciaLegacy,
} from "@/lib/persistencia";
import {
  ESTADOS_TAREA_POR_DEFECTO,
  OPCIONES_ESTADO_TAREA,
  estadosIguales,
  normalizarEstados,
} from "@/lib/estadosTarea";
import type { CampoFecha, EstadoFiltro, FiltrosTareas } from "@/lib/services/tareasService";
import styles from "./Tareas.module.css";

type FiltrosGuardados = {
  version: 2;
  usuarioId: number | null;
  rangoPersonalizado: boolean;
  busqueda: string;
  estado: EstadoFiltro[];
  campoFecha: CampoFecha;
  desde: string;
  hasta: string;
  entidad: number | "";
  campana: number | "";
  subcampana: number | "";
  prioridad: string;
};

export default function TareasPage() {
  const { eventos, subtareaEventos, observarTarea, dejarDeObservarTarea, wsDisponible } = useTasksWebSocket();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro[]>(
    ESTADOS_TAREA_POR_DEFECTO
  );
  const [campoFecha, setCampoFecha] = useState<CampoFecha>("solicitud");
  const rangoInicial = useMemo(() => rangoFechasPorDefecto(), []);
  const [desde, setDesde] = useState(rangoInicial.desde);
  const [hasta, setHasta] = useState(rangoInicial.hasta);
  const [filtroEntidad, setFiltroEntidad] = useState<number | "">("");
  const [filtroCampana, setFiltroCampana] = useState<number | "">("");
  const [filtroSubcampana, setFiltroSubcampana] = useState<number | "">("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [hidratado, setHidratado] = useState(false);
  const usuarioId = useMemo(() => getUsuarioActual()?.id ?? null, []);
  const claveFiltros = useMemo(
    () => clavePersistencia("tareas:filtros", usuarioId),
    [usuarioId]
  );

  const filtros = useMemo<FiltrosTareas>(
    () => ({ busqueda, estado: filtroEstado, campoFecha, desde, hasta, entidad: filtroEntidad, campana: filtroCampana, subcampana: filtroSubcampana, prioridad: filtroPrioridad }),
    [busqueda, filtroEstado, campoFecha, desde, hasta, filtroEntidad, filtroCampana, filtroSubcampana, filtroPrioridad]
  );
  const { tareas, cargando, error, cargar, setTareas } = useTareas(
    filtros,
    hidratado
  );

  useEffect(() => {
    if (!hidratado || wsDisponible) return;
    const intervalo = setInterval(() => {
      void cargar();
    }, 30000);
    return () => clearInterval(intervalo);
  }, [hidratado, wsDisponible, cargar]);

  // Restaura los filtros del usuario actual al montar o cambiar de cuenta.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHidratado(false);
    limpiarPersistenciaLegacy();

    const r = rangoFechasPorDefecto();
    setBusqueda("");
    setFiltroEstado(ESTADOS_TAREA_POR_DEFECTO);
    setCampoFecha("solicitud");
    setDesde(r.desde);
    setHasta(r.hasta);
    setFiltroEntidad("");
    setFiltroCampana("");
    setFiltroSubcampana("");
    setFiltroPrioridad("");

    const guardados = leerJson<Partial<FiltrosGuardados>>(claveFiltros);

    if (
      guardados &&
      guardados.version === 2 &&
      guardados.usuarioId === usuarioId
    ) {
      if (typeof guardados.busqueda === "string") setBusqueda(guardados.busqueda);

      if (Array.isArray(guardados.estado)) {
        setFiltroEstado(
          normalizarEstados(guardados.estado, OPCIONES_ESTADO_TAREA)
        );
      }

      if (guardados.campoFecha) setCampoFecha(guardados.campoFecha);

      // Las fechas solo se restauran si el usuario las personalizó; si no,
      // se usa el rango móvil actual (ayer/hoy cambian con el tiempo).
      if (guardados.rangoPersonalizado === true) {
        if (typeof guardados.desde === "string") setDesde(guardados.desde);
        if (typeof guardados.hasta === "string") setHasta(guardados.hasta);
      }

      if (typeof guardados.entidad === "number" || guardados.entidad === "") setFiltroEntidad(guardados.entidad);
      if (typeof guardados.campana === "number" || guardados.campana === "") setFiltroCampana(guardados.campana);
      if (typeof guardados.subcampana === "number" || guardados.subcampana === "") setFiltroSubcampana(guardados.subcampana);
      if (typeof guardados.prioridad === "string") setFiltroPrioridad(guardados.prioridad);
    }

    setHidratado(true);
  }, [claveFiltros, usuarioId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hidratado) return;

    const r = rangoFechasPorDefecto();
    const rangoPersonalizado = desde !== r.desde || hasta !== r.hasta;

    const guardados: FiltrosGuardados = {
      version: 2,
      usuarioId,
      rangoPersonalizado,
      busqueda,
      estado: filtroEstado,
      campoFecha,
      desde,
      hasta,
      entidad: filtroEntidad,
      campana: filtroCampana,
      subcampana: filtroSubcampana,
      prioridad: filtroPrioridad,
    };

    guardarJson(claveFiltros, guardados);
  }, [hidratado, claveFiltros, usuarioId, busqueda, filtroEstado, campoFecha, desde, hasta, filtroEntidad, filtroCampana, filtroSubcampana, filtroPrioridad]);

  const idsTareas = useMemo(
    () =>
      tareas
        .filter((tarea) =>
          tarea.estado === "EN_DESARROLLO" ||
          tarea.estado === "REAPERTURA_PENDIENTE" ||
          (
            tarea.estado === "SOLUCIONADO" &&
            tarea.confirmacion_cliente === "PENDIENTE"
          )
        )
        .map((tarea) => tarea.id),
    [tareas]
  );
  const idsTareasKey = idsTareas.join(",");
  useEffect(() => {
    console.log("Tareas recibidas:", tareas.length);
    console.log("IDs con WebSocket:", idsTareas);

    console.table(
      tareas.map((tarea) => ({
        id: tarea.id,
        estado: tarea.estado,
        confirmacion: tarea.confirmacion_cliente,
        observar: idsTareas.includes(tarea.id),
      }))
    );
  }, [tareas, idsTareas]);
  const rangoDefecto = rangoFechasPorDefecto();
  const usaRangoFechas = !estadoIgnoraRangoFechas(filtroEstado);
  const hayFiltros =
    !estadosIguales(filtroEstado, ESTADOS_TAREA_POR_DEFECTO) ||
    !!busqueda ||
    (usaRangoFechas && (desde !== rangoDefecto.desde || hasta !== rangoDefecto.hasta)) ||
    filtroEntidad !== "" ||
    filtroCampana !== "" ||
    filtroSubcampana !== "" ||
    filtroPrioridad !== "";

  const limpiarFiltros = () => {
    const r = rangoFechasPorDefecto();
    setFiltroEstado(ESTADOS_TAREA_POR_DEFECTO);
    setCampoFecha("solicitud");
    setDesde(r.desde);
    setHasta(r.hasta);
    setBusqueda("");
    setFiltroEntidad("");
    setFiltroCampana("");
    setFiltroSubcampana("");
    setFiltroPrioridad("");
    cargar({ busqueda: "", estado: ESTADOS_TAREA_POR_DEFECTO, campoFecha: "solicitud", desde: r.desde, hasta: r.hasta, entidad: "", campana: "", subcampana: "", prioridad: "" });
  };

  const handleEstadoChange = (estado: EstadoFiltro[]) => {
    setFiltroEstado(normalizarEstados(estado, OPCIONES_ESTADO_TAREA));
  };

  useEffect(() => {
    const ids = idsTareasKey
      ? idsTareasKey.split(",").map(Number)
      : [];

    ids.forEach((id) => observarTarea(id));

    return () => {
      ids.forEach((id) => dejarDeObservarTarea(id));
    };
  }, [idsTareasKey, observarTarea, dejarDeObservarTarea]);

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
            confirmacion_cliente:
              evento.confirmacion_cliente !== undefined
                ? evento.confirmacion_cliente
                : actualizada.confirmacion_cliente,
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
        entidadId={filtroEntidad}
        onEntidadChange={setFiltroEntidad}
        campanaId={filtroCampana}
        subcampanaId={filtroSubcampana}
        onCampanaChange={({ campanaId, subcampanaId }) => {
          setFiltroCampana(campanaId);
          setFiltroSubcampana(subcampanaId);
        }}
        estado={filtroEstado}
        onEstadoChange={handleEstadoChange}
        prioridad={filtroPrioridad}
        onPrioridadChange={setFiltroPrioridad}
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
