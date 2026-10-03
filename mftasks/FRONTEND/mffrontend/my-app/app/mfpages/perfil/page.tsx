"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { obtenerDatosMe, DatosUsuario } from "@/lib/auth";
import type { CampanaPermitida, EquipoInfo } from "@/lib/types";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import {
  obtenerPreferenciasNotificacion,
  guardarPreferenciasNotificacion,
  PreferenciasNotificacion,
} from "@/lib/notificaciones";
import AlertasResumen from "@/components/perfil/AlertasResumen";
import styles from "./Perfil.module.css";

type CampoBooleano = Exclude<keyof PreferenciasNotificacion, "fecha_actualizacion">;

const CAMPOS_CLIENTE: { key: CampoBooleano; label: string }[] = [
  { key: "cliente_solicitud_creada", label: "Solicitud creada" },
  { key: "cliente_solicitud_resuelta", label: "Aprobación o rechazo de solicitudes" },
  { key: "cliente_solicitud_standby", label: "Solicitud en pausa (standby)" },
  { key: "cliente_solicitud_solucionada", label: "Solicitud solucionada" },
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
  const [cargando, setCargando] = useState(true);
  const [alertasAbierto, setAlertasAbierto] = useState(false);
  const [campanasAbierto, setCampanasAbierto] = useState(true);
  const [notifAbierto, setNotifAbierto] = useState(true);
  const [prefs, setPrefs] = useState<PreferenciasNotificacion | null>(null);
  const [prefsGuardadas, setPrefsGuardadas] = useState<PreferenciasNotificacion | null>(null);
  const [guardando, setGuardando] = useState(false);
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
      .catch(() => { if (!cancel) setEquipos([]); })
      .finally(() => { if (!cancel) setCargando(false); });

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

  const actualizarPref = (campo: CampoBooleano, valor: boolean) => {
    setPrefs((prev) => (prev ? { ...prev, [campo]: valor } : prev));
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

      {!esAdmin && (
        <section className={styles.alertsCard}>
          <button
            type="button"
            className={styles.alertsHeader}
            aria-expanded={alertasAbierto}
            onClick={() => setAlertasAbierto((v) => !v)}
          >
            <span>Alertas</span>
            <span className={`${styles.chevron} ${alertasAbierto ? styles.chevronOpen : ""}`}>▸</span>
          </button>
          {alertasAbierto && (
            <div className={styles.alertsBody}>
              <AlertasResumen />
            </div>
          )}
        </section>
      )}

      <section className={styles.card}>
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
            <span className={styles.label}>Cargo</span>
            <span className={styles.value}>{usuario?.cargo || "—"}</span>
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

      {!esAdmin &&
        <section className={styles.alertsCard}>
          <button
            type="button"
            className={styles.alertsHeader}
            aria-expanded={campanasAbierto}
            onClick={() => setCampanasAbierto((v) => !v)}
          >
            <span>Campañas permitidas</span>
            <span className={`${styles.chevron} ${campanasAbierto ? styles.chevronOpen : ""}`}>▸</span>
          </button>
          {campanasAbierto && (
            <div className={styles.alertsBody}>
              {campanasPermitidas.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  Sin permisos asignados. Contacta al administrador.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {campanasPermitidas.map((campana) => (
                    <div key={campana.id}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {campana.nombre}
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280", marginLeft: 6 }}>
                          {campana.codigo}
                        </span>
                      </div>
                      <div className={styles.badges} style={{ marginTop: 6 }}>
                        {campana.subcampanas.length > 0 ? (
                          campana.subcampanas.map((sub) => (
                            <span key={sub.id} className={styles.badge}>{sub.nombre}</span>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>Sin subcampañas activas</span>
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
      

      {prefs && (esCliente || esEquipo) && (
        <section className={styles.alertsCard}>
          <button
            type="button"
            className={styles.alertsHeader}
            aria-expanded={notifAbierto}
            onClick={() => setNotifAbierto((v) => !v)}
          >
            <span>Notificaciones por correo</span>
            <span className={`${styles.chevron} ${notifAbierto ? styles.chevronOpen : ""}`}>▸</span>
          </button>
          {notifAbierto && (
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
          )}
        </section>
      )}
    </div>
  );
}
