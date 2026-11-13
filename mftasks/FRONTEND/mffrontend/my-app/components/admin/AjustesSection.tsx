
"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import Switch from "@/components/ui/Switch";

import styles from "./AdminSections.module.css";

type HorarioLaboral = {
  id: number;
  dia: number;
  activo: boolean;
  hora_inicio: string;
  hora_fin: string;
};

type Props = {
  setMsg: (msg: string | null) => void;
};

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const HORARIOS_DEFAULT: HorarioLaboral[] = DIAS.map((_, dia) => ({
  id: 0,
  dia,
  activo: dia !== 6,
  hora_inicio: "09:00",
  hora_fin: dia === 5 || dia === 6 ? "13:00" : "18:00",
}));

export default function AjustesSection({ setMsg }: Props) {
  const [horarios, setHorarios] = useState<HorarioLaboral[]>([]);
  const [originales, setOriginales] = useState<HorarioLaboral[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [horasLimite, setHorasLimite] = useState(72);
  const [horasOriginales, setHorasOriginales] = useState(72);

  const [horasConfirmacion, setHorasConfirmacion] = useState(45);
  const [horasConfirmacionOriginales, setHorasConfirmacionOriginales] = useState(45);

  const [horaAlerta, setHoraAlerta] = useState("09:00");
  const [horaOriginal, setHoraOriginal] = useState("09:00");

  const [cargandoConfig, setCargandoConfig] = useState(true);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [guardandoConfirmacion, setGuardandoConfirmacion] = useState(false);
  const [guardandoHora, setGuardandoHora] = useState(false);

  const cargarConfiguracion = async () => {
    setCargandoConfig(true);

    try {
      const data = await apiFetch<{
        id: number;
        horas_limite: number;
        horas_confirmacion: number;
        hora_alerta_diaria: string;
      }>("/api/tasks/configuracion-aprobacion/1/");

      setHorasLimite(data.horas_limite);
      setHorasOriginales(data.horas_limite);

      setHorasConfirmacion(data.horas_confirmacion);
      setHorasConfirmacionOriginales(data.horas_confirmacion);

      const hora = (data.hora_alerta_diaria || "09:00").slice(0, 5);
      setHoraAlerta(hora);
      setHoraOriginal(hora);

    } catch (e) {
      setMsg(
        `Error al cargar configuración: ${(e as Error).message}`
      );
    } finally {
      setCargandoConfig(false);
    }
  };

  const guardarConfiguracion = async () => {
    if (
      !Number.isInteger(horasLimite) ||
      horasLimite < 1 ||
      horasLimite > 72
    ) {
      setMsg("El plazo debe ser un número entero entre 1 y 72 horas.");
      return;
    }

    if (horasLimite === horasOriginales) {
      setMsg("No hay cambios pendientes.");
      return;
    }

    setGuardandoConfig(true);

    try {
      await apiFetch(
        "/api/tasks/configuracion-aprobacion/1/",
        {
          method: "PATCH",
          body: JSON.stringify({
            horas_limite: horasLimite,
          }),
        }
      );

      setHorasOriginales(horasLimite);
      setMsg("Plazo de aprobación actualizado correctamente.");

    } catch (e) {
      setMsg(
        `Error al guardar configuración: ${(e as Error).message}`
      );
    } finally {
      setGuardandoConfig(false);
    }
  };

  const guardarConfirmacion = async () => {
    if (
      !Number.isInteger(horasConfirmacion) ||
      horasConfirmacion < 0 ||
      horasConfirmacion > 270
    ) {
      setMsg(
        "El plazo debe ser un número entero entre 0 y 270 horas laborales."
      );
      return;
    }

    if (horasConfirmacion === horasConfirmacionOriginales) {
      setMsg("No hay cambios pendientes.");
      return;
    }

    setGuardandoConfirmacion(true);

    try {
      await apiFetch(
        "/api/tasks/configuracion-aprobacion/1/",
        {
          method: "PATCH",
          body: JSON.stringify({
            horas_confirmacion: horasConfirmacion,
          }),
        }
      );

      setHorasConfirmacionOriginales(horasConfirmacion);

      setMsg(
        horasConfirmacion === 0
          ? "La confirmación automática inmediata fue configurada correctamente."
          : "Plazo de confirmación del cliente actualizado correctamente."
      );

    } catch (e) {
      setMsg(
        `Error al guardar configuración: ${(e as Error).message}`
      );
    } finally {
      setGuardandoConfirmacion(false);
    }
  };

  const guardarHoraAlerta = async () => {
    if (!horaAlerta) {
      setMsg("Debes indicar una hora para la alerta diaria.");
      return;
    }

    if (horaAlerta === horaOriginal) {
      setMsg("No hay cambios pendientes.");
      return;
    }

    setGuardandoHora(true);

    try {
      await apiFetch(
        "/api/tasks/configuracion-aprobacion/1/",
        {
          method: "PATCH",
          body: JSON.stringify({
            hora_alerta_diaria: horaAlerta,
          }),
        }
      );

      setHoraOriginal(horaAlerta);
      setMsg("Hora de la alerta diaria actualizada correctamente.");

    } catch (e) {
      setMsg(
        `Error al guardar configuración: ${(e as Error).message}`
      );
    } finally {
      setGuardandoHora(false);
    }
  };

  // --------------------------------------------------
  // CARGAR HORARIOS
  // --------------------------------------------------

  const cargarHorarios = async () => {
    setCargando(true);

    try {
      const data = await apiFetch<
        HorarioLaboral[] | { results: HorarioLaboral[] }
      >("/api/tasks/horarios-laborales/");

      const registros = Array.isArray(data)
        ? data
        : data.results ?? [];

      // Completar los siete días si todavía no existen registros.
      const completos = DIAS.map((_, dia) => {
        const encontrado = registros.find(h => h.dia === dia);

        return encontrado
          ? { ...encontrado }
          : { ...HORARIOS_DEFAULT[dia] };
      });

      setHorarios(completos);
      setOriginales(completos.map(h => ({ ...h })));
    } catch (e) {
      setMsg(`Error al cargar horarios: ${(e as Error).message}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarHorarios();
    cargarConfiguracion();
  }, []);

  // --------------------------------------------------
  // MODIFICAR HORARIO
  // --------------------------------------------------

  const actualizarHorario = (
    dia: number,
    cambios: Partial<HorarioLaboral>
  ) => {
    setHorarios(prev =>
      prev.map(h =>
        h.dia === dia
          ? { ...h, ...cambios }
          : h
      )
    );
  };

  // --------------------------------------------------
  // DETECTAR CAMBIOS
  // --------------------------------------------------

  const hayCambios = horarios.some(h => {
    const original = originales.find(o => o.dia === h.dia);

    return (
      !original ||
      h.activo !== original.activo ||
      h.hora_inicio !== original.hora_inicio ||
      h.hora_fin !== original.hora_fin
    );
  });

  // --------------------------------------------------
  // VALIDAR HORARIOS
  // --------------------------------------------------

  const validarHorarios = (): string | null => {
    for (const horario of horarios) {
      if (!horario.activo) continue;

      if (!horario.hora_inicio || !horario.hora_fin) {
        return `Completa las horas de ${DIAS[horario.dia]}.`;
      }

      if (horario.hora_inicio >= horario.hora_fin) {
        return `La hora de fin debe ser posterior al inicio (${DIAS[horario.dia]}).`;
      }
    }

    return null;
  };

  // --------------------------------------------------
  // GUARDAR CAMBIOS
  // --------------------------------------------------

  const guardarHorarios = async () => {
    const error = validarHorarios();

    if (error) {
      setMsg(`Error: ${error}`);
      return;
    }

    if (!hayCambios) {
      setMsg("No hay cambios pendientes.");
      return;
    }

    setGuardando(true);

    try {
      const cambios = horarios.filter(h => {
        const original = originales.find(o => o.dia === h.dia);

        return (
          !original ||
          h.activo !== original.activo ||
          h.hora_inicio !== original.hora_inicio ||
          h.hora_fin !== original.hora_fin
        );
      });

      // Actualizar únicamente los registros modificados.
      await Promise.all(
        cambios.map(h => {
          if (!h.id) {
            throw new Error(
              `No existe un registro para ${DIAS[h.dia]}. Créalo primero en Django.`
            );
          }

          return apiFetch(
            `/api/tasks/horarios-laborales/${h.id}/`,
            {
              method: "PATCH",
              body: JSON.stringify({
                activo: h.activo,
                hora_inicio: h.hora_inicio,
                hora_fin: h.hora_fin,
              }),
            }
          );
        })
      );

      setMsg("Horarios laborales actualizados correctamente.");
      await cargarHorarios();

    } catch (e) {
      setMsg(`Error al guardar horarios: ${(e as Error).message}`);
    } finally {
      setGuardando(false);
    }
  };

  // --------------------------------------------------
  // RESTABLECER CAMBIOS
  // --------------------------------------------------

  const restablecerCambios = () => {
    setHorarios(originales.map(h => ({ ...h })));
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.settingsGrid}>

      <div className={`${styles.card} ${styles.settingsCard}`}>

        <div className={styles.settingsHeader}>
          <div>
            <h3 className={styles.settingsTitle}>
              Plazo para aprobar o rechazar solicitudes
            </h3>

            <p className={styles.settingsDescription}>
              Define cuánto tiempo tienen los responsables para resolver
              una solicitud pendiente.
            </p>
          </div>
        </div>

        {cargandoConfig ? (
          <p className={styles.settingsLoading}>
            Cargando configuración...
          </p>
        ) : (
          <div className={styles.settingsForm}>
            <label className={styles.field}>
              <span>Plazo máximo de aprobación (horas)</span>

              <input
                type="number"
                min={1}
                max={72}
                step={1}
                value={horasLimite}
                disabled={guardandoConfig}
                onChange={e => {
                  const valor = e.target.value;
                  setHorasLimite(valor === "" ? 0 : Number(valor));
                }}
                className={styles.input}
              />
            </label>

            <div className={styles.settingsNote}>
              <strong>Importante:</strong>{" "}
              Si una solicitud no recibe respuesta de aprobación o rechazo dentro del plazo,
              será rechazada automáticamente.
              El plazo se cuenta únicamente durante el horario laboral configurado.
              Al guardar, se recalcularán las solicitudes pendientes; las cerradas no se alteran.
            </div>
            <div className={styles.settingsActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={
                  horasLimite === horasOriginales ||
                  guardandoConfig ||
                  cargandoConfig
                }
                onClick={() => setHorasLimite(horasOriginales)}
              >
                Descartar
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                disabled={
                  horasLimite === horasOriginales ||
                  guardandoConfig ||
                  cargandoConfig
                }
                onClick={guardarConfiguracion}
              >
                {guardandoConfig ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}

      </div>

      <div className={`${styles.card} ${styles.settingsCard}`}>

        <div className={styles.settingsHeader}>
          <div>
            <h3 className={styles.settingsTitle}>
              Plazo para confirmación del cliente
            </h3>

            <p className={styles.settingsDescription}>
              Define cuántas horas laborales tiene el cliente para confirmar o
              reabrir una solución.
            </p>
          </div>
        </div>

        {cargandoConfig ? (
          <p className={styles.settingsLoading}>
            Cargando configuración...
          </p>
        ) : (
          <div className={styles.settingsForm}>
            <label className={styles.field}>
              <span>Plazo máximo de confirmación (horas laborales)</span>

              <input
                type="number"
                min={0}
                max={270}
                step={1}
                value={horasConfirmacion}
                disabled={guardandoConfirmacion}
                onChange={e => {
                  const valor = e.target.value;
                  setHorasConfirmacion(valor === "" ? 0 : Number(valor));
                }}
                className={styles.input}
              />
            </label>

            <div className={styles.settingsNote}>
              <strong>Importante:</strong>{" "}
              Si el cliente no confirma ni reabre dentro del plazo, la solicitud
              será confirmada automáticamente como solucionada.
              El tiempo se cuenta únicamente durante los horarios laborales configurados.
              Al guardar, se recalcularán las soluciones pendientes de confirmación.
              Si estableces el valor en 0, la solución se confirma inmediatamente.
            </div>
            <div className={styles.settingsActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={
                  horasConfirmacion === horasConfirmacionOriginales ||
                  guardandoConfirmacion ||
                  cargandoConfig
                }
                onClick={() => setHorasConfirmacion(horasConfirmacionOriginales)}
              >
                Descartar
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                disabled={
                  horasConfirmacion === horasConfirmacionOriginales ||
                  guardandoConfirmacion ||
                  cargandoConfig
                }
                onClick={guardarConfirmacion}
              >
                {guardandoConfirmacion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}

      </div>

      <div className={`${styles.card} ${styles.settingsCard}`}>

        <div className={styles.settingsHeader}>
          <div>
            <h3 className={styles.settingsTitle}>
              Hora de la notificación diaria
            </h3>

            <p className={styles.settingsDescription}>
              Define a qué hora se envía la alerta diaria de solicitudes sin
              solucionar a los miembros de los equipos.
            </p>
          </div>
        </div>

        {cargandoConfig ? (
          <p className={styles.settingsLoading}>
            Cargando configuración...
          </p>
        ) : (
          <div className={styles.settingsForm}>
            <label className={styles.field}>
              <span>Hora de envío</span>

              <input
                type="time"
                value={horaAlerta}
                disabled={guardandoHora}
                onChange={e => setHoraAlerta(e.target.value)}
                className={styles.input}
              />
            </label>

            <div className={styles.settingsNote}>
              <strong>Importante:</strong>{" "}
              La alerta se envía a esta hora a todos los equipos. Si se cambia
              la hora, el nuevo horario se aplica el mismo día.
            </div>
            <div className={styles.settingsActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={
                  horaAlerta === horaOriginal ||
                  guardandoHora ||
                  cargandoConfig
                }
                onClick={() => setHoraAlerta(horaOriginal)}
              >
                Descartar
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                disabled={
                  horaAlerta === horaOriginal ||
                  guardandoHora ||
                  cargandoConfig
                }
                onClick={guardarHoraAlerta}
              >
                {guardandoHora ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}

      </div>

      <div className={`${styles.card} ${styles.settingsCard} ${styles.settingsCardWide}`}>

        <div className={styles.settingsHeader}>
          <div>
            <h3 className={styles.settingsTitle}>
              Horarios laborales
            </h3>

            <p className={styles.settingsDescription}>
              Configura las horas de trabajo para cada día de la semana.
            </p>
          </div>

        </div>

        <div className={styles.settingsNote}>
          <strong>Importante:</strong>{" "}
          Estos horarios se aplican globalmente a los contadores de tareas y
          subtareas. Los días desactivados no acumulan tiempo laboral.
        </div>

        {cargando ? (
          <div className={styles.settingsLoading} style={{ padding: 24, textAlign: "center" }}>
            Cargando horarios...
          </div>
        ) : (
          <div className={styles.hoursSection}>

            <div className={styles.hoursHeader}>
              <span>DÍA</span>
              <span>HORA DE INICIO</span>
              <span>HORA DE FIN</span>
              <span>LABORABLE</span>
            </div>

            <div className={styles.hoursTable}>
              {horarios.map(h => (
                <div
                  key={h.dia}
                  className={styles.hoursRow}
                  style={{ opacity: h.activo ? 1 : 0.65 }}
                >
                  <strong className={styles.hoursDay}>
                    {DIAS[h.dia]}
                  </strong>

                  <input
                    type="time"
                    value={h.hora_inicio}
                    disabled={!h.activo || guardando}
                    onChange={e =>
                      actualizarHorario(h.dia, {
                        hora_inicio: e.target.value,
                      })
                    }
                    className={styles.input}
                  />

                  <input
                    type="time"
                    value={h.hora_fin}
                    disabled={!h.activo || guardando}
                    onChange={e =>
                      actualizarHorario(h.dia, {
                        hora_fin: e.target.value,
                      })
                    }
                    className={styles.input}
                  />

                  <div className={styles.hoursSwitch}>
                    <Switch
                      checked={h.activo}
                      disabled={guardando}
                      onChange={activo =>
                        actualizarHorario(h.dia, { activo })
                      }
                      label={
                        h.activo
                          ? "Día laborable"
                          : "Día no laborable"
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.settingsActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={restablecerCambios}
                disabled={!hayCambios || guardando}
              >
                Descartar
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={guardarHorarios}
                disabled={!hayCambios || guardando || cargando}
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
