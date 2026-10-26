"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { obtenerDatosMe, DatosUsuario } from "@/lib/auth";
import type { CampanaPermitida, DisponibilidadUsuario, EquipoInfo } from "@/lib/types";
import { guardarDisponibilidad, obtenerDisponibilidad } from "@/lib/disponibilidad";
import { crearSegmentoTarea } from "@/lib/tareaUrl";
import Switch from "@/components/ui/Switch";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  obtenerPreferenciasNotificacion,
  guardarPreferenciasNotificacion,
  PreferenciasNotificacion,
} from "@/lib/notificaciones";
import styles from "./Perfil.module.css";

type CampoBooleano = Exclude<keyof PreferenciasNotificacion, "fecha_actualizacion">;
type TabPerfil = "informacion" | "preferencias";

const CAMPOS_CLIENTE: { key: CampoBooleano; label: string }[] = [
  { key: "cliente_solicitud_creada", label: "Solicitud creada" },
  { key: "cliente_solicitud_resuelta", label: "Aprobación o rechazo de solicitudes" },
  { key: "cliente_solicitud_standby", label: "Solicitud en pausa (standby)" },
  { key: "cliente_solicitud_reanudada", label: "Solicitud reanudada (sale de pausa)" },
  { key: "cliente_solicitud_solucionada", label: "Solicitud resuelta" },
  { key: "cliente_resumen_diario", label: "Resumen diario de mis solicitudes (9:00 a.m.)" },
];

const CAMPOS_EQUIPO: { key: CampoBooleano; label: string; descripcion?: string }[] = [
  { key: "equipo_nueva_solicitud", label: "Nueva solicitud en mi equipo" },
  { key: "equipo_pendiente_revision", label: "Solicitudes pendientes de revisión (aprobar o rechazar)" },
  { key: "equipo_alerta_diaria", label: "Alerta diaria (9:00 a.m.) de solicitudes sin solucionar" },
];

function CampoNotificacion({
  titulo,
  descripcion,
  checked,
  disabled,
  onChange,
}: {
  titulo: string;
  descripcion?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={styles.notifRow}>
      <div className={styles.notifText}>
        <span className={styles.notifLabel}>{titulo}</span>
        {descripcion && <span className={styles.notifDesc}>{descripcion}</span>}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        label={titulo}
      />
    </div>
  );
}

export default function PerfilPage() {
  const [usuario, setUsuario] = useState<DatosUsuario | null>(null);
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [campanasPermitidas, setCampanasPermitidas] = useState<CampanaPermitida[]>([]);
  const [tabPerfil, setTabPerfil] = useState<TabPerfil>("informacion");
  const [campanasAbierto, setCampanasAbierto] = useState(true);
  const [prefs, setPrefs] = useState<PreferenciasNotificacion | null>(null);
  const [prefsGuardadas, setPrefsGuardadas] = useState<PreferenciasNotificacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadUsuario | null>(null);
  const [guardandoDisponibilidad, setGuardandoDisponibilidad] = useState(false);
  const [modalPendientesAbierto, setModalPendientesAbierto] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancel = false;

    obtenerDatosMe()
      .then((u) => { if (!cancel) setUsuario(u); })
      .catch(() => { /* mantiene datos en caché local */ });

    apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
      .then((data) => {
        if (cancel) return;
        const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
        setEquipos(arr);
      })
      .catch(() => { if (!cancel) setEquipos([]); });

    apiFetch<CampanaPermitida[] | { results: CampanaPermitida[] }>("/api/campanas/campanas/mis-permisos/")
      .then((data) => {
        if (cancel) return;
        const arr = Array.isArray(data) ? data : (data as { results: CampanaPermitida[] }).results ?? [];
        setCampanasPermitidas(arr);
      })
      .catch(() => { if (!cancel) setCampanasPermitidas([]); });

    obtenerPreferenciasNotificacion()
      .then((p) => {
        if (cancel) return;
        setPrefs(p);
        setPrefsGuardadas(p);
      })
      .catch(() => { /* sin preferencias: no se muestra la sección */ });

    obtenerDisponibilidad()
      .then((d) => { if (!cancel) setDisponibilidad(d); })
      .catch(() => { /* se mantiene disponible por defecto */ });

    return () => { cancel = true; };
  }, []);

  const roles = usuario?.roles ?? [];
  const esAdmin = roles.map((r) => r.toLowerCase()).includes("administrador");
  const uid = usuario?.id;

  const misEquipos = equipos.filter((e) =>
    (uid != null && e.lider?.id === uid) ||
    (e.mi_rol_en_equipo != null && e.mi_rol_en_equipo !== "") ||
    (uid != null && (e.miembros ?? []).some((m) => m.id_usuario === uid))
  );

  const esCliente = roles.map((r) => r.toLowerCase()).includes("cliente");
  const esEquipo = misEquipos.length > 0 || roles.some((r) =>
    ["miembro", "gtr", "gerente", "subgerente", "jefe"].includes(r.toLowerCase())
  );
  const prefsSucias =
    prefs != null && prefsGuardadas != null &&
    JSON.stringify(prefs) !== JSON.stringify(prefsGuardadas);

  const equiposSinSublider = disponibilidad?.equipos_sin_sublider ?? [];
  const equiposSinCobertura = disponibilidad?.equipos_sin_cobertura ?? [];
  const subtareasPendientes = disponibilidad?.subtareas_pendientes ?? [];

  const actualizarPref = (campo: CampoBooleano, valor: boolean) => {
    setPrefs((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  };

  const actualizarDisponibilidad = (cambios: Partial<DisponibilidadUsuario>) => {
    setDisponibilidad((prev) => ({
      estado: prev?.estado ?? "DISPONIBLE",
      fecha_inicio: prev?.fecha_inicio ?? null,
      fecha_fin: prev?.fecha_fin ?? null,
      motivo: prev?.motivo ?? "",
      ...cambios,
    }));
  };

  const guardarMiDisponibilidad = async () => {
    if (!disponibilidad) return;
    setGuardandoDisponibilidad(true);
    try {
      const actualizada = await guardarDisponibilidad(disponibilidad);
      setDisponibilidad(actualizada);
      showToast("Disponibilidad actualizada", "success");
    } catch (e) {
      const mensaje = (e as Error).message;
      const esBloqueo = /no puedes marcarte como indisponible|sub-?l[ií]der|subtareas pendientes/i.test(
        mensaje
      );

      if (esBloqueo) {
        try {
          const actual = await obtenerDisponibilidad();
          setDisponibilidad(actual);
          setModalPendientesAbierto(true);
        } catch {
          showToast(mensaje, "error");
        }
      } else {
        showToast(mensaje, "error");
      }
    } finally {
      setGuardandoDisponibilidad(false);
    }
  };

  const guardarPrefs = async () => {
    if (!prefs) return;
    setGuardando(true);
    try {
      const actualizado = await guardarPreferenciasNotificacion(prefs);
      setPrefs(actualizado);
      setPrefsGuardadas(actualizado);
      showToast("Preferencias guardadas", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Perfil</h2>

      <div className={styles.tabs} role="tablist" aria-label="Secciones del perfil">
        <button
          type="button"
          role="tab"
          id="perfil-tab-informacion"
          aria-selected={tabPerfil === "informacion"}
          aria-controls="perfil-panel-informacion"
          className={tabPerfil === "informacion" ? styles.tabActive : styles.tab}
          onClick={() => setTabPerfil("informacion")}
        >
          Información
        </button>
        {!esAdmin && (
          <button
            type="button"
            role="tab"
            id="perfil-tab-preferencias"
            aria-selected={tabPerfil === "preferencias"}
            aria-controls="perfil-panel-preferencias"
            className={tabPerfil === "preferencias" ? styles.tabActive : styles.tab}
            onClick={() => setTabPerfil("preferencias")}
          >
            Preferencias
          </button>
        )}

      </div>

      {tabPerfil === "informacion" && (
        <section
          className={styles.card}
          id="perfil-panel-informacion"
          role="tabpanel"
          aria-labelledby="perfil-tab-informacion"
        >
          <h3 className={styles.cardTitle}>Información de la cuenta</h3>
          <div className={styles.dataGrid}>
            <div className={styles.field}>
              <span className={styles.label}>Nombres y apellidos</span>
              <span className={styles.value}>
                {usuario ? `${usuario.nombres} ${usuario.apellidos}` : "—"}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Correo</span>
              <span className={styles.value}>{usuario?.email ?? "—"}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Código</span>
              <span className={styles.valueMono}>{usuario?.codigo ?? "—"}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Rol(es)</span>
              <span className={styles.badges}>
                {roles.length > 0
                  ? roles.map((r) => <span key={r} className={styles.badge}>{r}</span>)
                  : <span className={styles.value}>—</span>}
              </span>
            </div>
          </div>
        </section>
      )}

      {tabPerfil === "preferencias" && (
        <section
          className={styles.card}
          id="perfil-panel-preferencias"
          role="tabpanel"
          aria-labelledby="perfil-tab-preferencias"
        >
          <h3 className={styles.cardTitle}>Disponibilidad</h3>
          {disponibilidad ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className={styles.dataGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Estado</span>
                  <select
                    value={disponibilidad.estado}
                    onChange={async (e) => {
                      const nuevoEstado = e.target
                        .value as DisponibilidadUsuario["estado"];

                      if (nuevoEstado === "INDISPONIBLE") {
                        let actual = disponibilidad;

                        try {
                          const fresca = await obtenerDisponibilidad();
                          actual = fresca;
                          setDisponibilidad(fresca);
                        } catch {
                          // Se valida igualmente al guardar.
                        }

                        if (
                          actual &&
                          ((actual.subtareas_pendientes?.length ?? 0) > 0 ||
                            (actual.equipos_sin_sublider?.length ?? 0) > 0 ||
                            (actual.equipos_sin_cobertura?.length ?? 0) > 0)
                        ) {
                          setDisponibilidad((prev) =>
                            prev ? { ...prev } : prev
                          );
                          setModalPendientesAbierto(true);
                          return;
                        }
                      }

                      actualizarDisponibilidad({
                        estado: nuevoEstado,
                        ...(nuevoEstado === "DISPONIBLE"
                          ? { fecha_inicio: null, fecha_fin: null, motivo: "" }
                          : {}),
                      });
                    }}
                    style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" }}
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="INDISPONIBLE">Indisponible</option>
                  </select>
                </label>

                {disponibilidad.estado === "INDISPONIBLE" && (
                  <>
                    <label className={styles.field}>
                      <span className={styles.label}>Desde</span>
                      <input
                        type="date"
                        value={disponibilidad.fecha_inicio ?? ""}
                        onChange={(e) =>
                          actualizarDisponibilidad({
                            fecha_inicio: e.target.value || null,
                          })
                        }
                        style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Hasta</span>
                      <input
                        type="date"
                        value={disponibilidad.fecha_fin ?? ""}
                        min={disponibilidad.fecha_inicio ?? undefined}
                        onChange={(e) =>
                          actualizarDisponibilidad({
                            fecha_fin: e.target.value || null,
                          })
                        }
                        style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Motivo *</span>
                      <input
                        type="text"
                        value={disponibilidad.motivo ?? ""}
                        maxLength={255}
                        onChange={(e) =>
                          actualizarDisponibilidad({ motivo: e.target.value })
                        }
                        placeholder="Motivo de la indisponibilidad"
                        style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "white" }}
                      />
                    </label>
                  </>
                )}
              </div>

              {equiposSinSublider.length > 0 && (
                <div className={styles.requirementsBox}>
                  <strong className={styles.requirementsTitle}>
                    Equipos sin sub-líder
                  </strong>
                  <p className={styles.pendingIntro}>
                    Para marcarte como indisponible necesitas un sub-líder
                    activo y disponible en cada equipo que lideras.
                  </p>
                  <ul className={styles.pendingList}>
                    {equiposSinSublider.map((equipo) => (
                      <li key={equipo.id} className={styles.pendingItem}>
                        <div className={styles.pendingTitle}>
                          {equipo.nombre}
                        </div>
                        <Link
                          href="/mfpages/equipos"
                          className={styles.pendingLink}
                        >
                          Ir a Equipos para asignar sub-líder
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className={styles.btnGuardar}
                  disabled={guardandoDisponibilidad}
                  onClick={guardarMiDisponibilidad}
                >
                  {guardandoDisponibilidad ? "Guardando…" : "Guardar disponibilidad"}
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.empty}>Cargando disponibilidad…</p>
          )}
        </section>
      )}

      {tabPerfil === "informacion" && !esAdmin &&
        <section className={styles.alertsCard}>
          <button
            type="button"
            className={styles.alertsHeader}
            aria-expanded={campanasAbierto}
            onClick={() => setCampanasAbierto((v) => !v)}
          >
            <span>Entidades permitidas</span>
            <span className={`${styles.chevron} ${campanasAbierto ? styles.chevronOpen : ""}`}>▸</span>
          </button>
          {campanasAbierto && (
            <div className={styles.alertsBody}>
              {campanasPermitidas.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                  Sin permisos asignados. Contacta al administrador.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {campanasPermitidas.map((campana) => (
                    <div key={campana.id}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                        {campana.entidad_nombre ? `${campana.entidad_nombre} ▸ ${campana.nombre}` : campana.nombre}
                      </div>
                      <div className={styles.badges} style={{ marginTop: 6 }}>
                        {campana.subcampanas.length > 0 ? (
                          campana.subcampanas.map((sub) => (
                            <span key={sub.id} className={styles.badge}>{sub.nombre}</span>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Sin subcampañas activas</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      }


      {tabPerfil === "preferencias" && prefs && (esCliente || esEquipo) && (
        <section className={styles.alertsCard}>
          <div className={styles.alertsHeader}>
            <span>Notificaciones por correo</span>
          </div>

          <div className={styles.alertsBody}>

            <CampoNotificacion
              titulo="Recibir correos"
              descripcion="Activa o desactiva todas las notificaciones por correo."
              checked={prefs.recibir_correos}
              onChange={(v) => actualizarPref("recibir_correos", v)}
            />

            {esCliente && (
              <div className={styles.notifGroup}>
                <h4 className={styles.notifGroupTitle}>Como cliente</h4>
                {CAMPOS_CLIENTE.map((campo) => (
                  <CampoNotificacion
                    key={campo.key}
                    titulo={campo.label}
                    checked={Boolean(prefs[campo.key])}
                    disabled={!prefs.recibir_correos}
                    onChange={(v) => actualizarPref(campo.key, v)}
                  />
                ))}
              </div>
            )}

            {esEquipo && (
              <div className={styles.notifGroup}>
                <h4 className={styles.notifGroupTitle}>Como líder / miembro</h4>
                {CAMPOS_EQUIPO.map((campo) => (
                  <CampoNotificacion
                    key={campo.key}
                    titulo={campo.label}
                    descripcion={campo.descripcion}
                    checked={Boolean(prefs[campo.key])}
                    disabled={!prefs.recibir_correos}
                    onChange={(v) => actualizarPref(campo.key, v)}
                  />
                ))}
              </div>
            )}

            <div className={styles.notifActions}>
              <button
                type="button"
                className={styles.btnGuardar}
                disabled={!prefsSucias || guardando}
                onClick={guardarPrefs}
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </section>
      )}

      {modalPendientesAbierto && (
        <Modal
          title="Requisitos para marcarte indisponible"
          onClose={() => setModalPendientesAbierto(false)}
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {equiposSinSublider.length > 0 && (
                <Link
                  href="/mfpages/equipos"
                  className={styles.pendingLink}
                  onClick={() => setModalPendientesAbierto(false)}
                >
                  Ir a Equipos
                </Link>
              )}
              <button
                type="button"
                className={styles.btnGuardar}
                onClick={() => setModalPendientesAbierto(false)}
              >
                Entendido
              </button>
            </div>
          }
        >
          <p className={styles.pendingIntro}>
            No puedes marcarte como indisponible hasta cumplir estos
            requisitos:
          </p>

          {equiposSinSublider.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <strong className={styles.requirementsTitle}>
                Equipos sin sub-líder
              </strong>
              <ul className={styles.pendingList}>
                {equiposSinSublider.map((equipo) => (
                  <li key={equipo.id} className={styles.pendingItem}>
                    <div className={styles.pendingTitle}>{equipo.nombre}</div>
                    <div className={styles.pendingMeta}>
                      Asigna un sub-líder activo y disponible en Equipos.
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {equiposSinCobertura.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <strong className={styles.requirementsTitle}>
                Equipos sin cobertura
              </strong>
              <p className={styles.pendingIntro}>
                Eres el último sub-líder disponible. Solicita a tu líder o al
                administrador que asigne otro sub-líder antes de ausentarte.
              </p>
              <ul className={styles.pendingList}>
                {equiposSinCobertura.map((equipo) => (
                  <li key={equipo.id} className={styles.pendingItem}>
                    <div className={styles.pendingTitle}>{equipo.nombre}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {subtareasPendientes.length > 0 && (
            <div>
              <strong className={styles.requirementsTitle}>
                Subtareas pendientes
              </strong>
              <p className={styles.pendingIntro}>
                Coordina la reasignación o solución de estas subtareas.
              </p>
              <ul className={styles.pendingList}>
                {subtareasPendientes.map((subtarea) => (
                  <li key={subtarea.id} className={styles.pendingItem}>
                    <div className={styles.pendingTitle}>
                      {subtarea.codigo && (
                        <span className={styles.pendingCode}>
                          {subtarea.codigo}
                        </span>
                      )}
                      <span>{subtarea.descripcion}</span>
                    </div>
                    <div className={styles.pendingMeta}>
                      <span>{subtarea.estado}</span>
                      <Link
                        href={`/mfpages/tareas/${crearSegmentoTarea(
                          subtarea.tarea_asunto,
                          subtarea.tarea_id
                        )}`}
                        className={styles.pendingLink}
                        onClick={() => setModalPendientesAbierto(false)}
                      >
                        {subtarea.tarea_ticket ??
                          `Solicitud #${subtarea.tarea_id}`}
                        {" · "}
                        {subtarea.tarea_asunto}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
