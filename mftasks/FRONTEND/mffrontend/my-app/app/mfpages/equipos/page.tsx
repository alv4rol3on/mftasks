"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo, EquipoMiembroDetallado } from "@/lib/types";

type EquipoApiResponse = EquipoInfo[] | { results: EquipoInfo[] };

function extraerEquipos(data: EquipoApiResponse): EquipoInfo[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) return (data as { results: EquipoInfo[] }).results ?? [];
  return [];
}

export default function EquiposPage() {
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipoExpandido, setEquipoExpandido] = useState<number | null>(null);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // modal indisponibilidad
  const [modalIndisponible, setModalIndisponible] = useState<{ equipoId: number; miembro: EquipoMiembroDetallado } | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [motivo, setMotivo] = useState("");

  const usuario = getUsuarioActual();
  const roles = (usuario?.roles ?? []).map((r) => r.toLowerCase());
  const esAdmin = roles.includes("administrador");
  const esClientePuro = roles.includes("cliente") && !roles.includes("asignador") && !roles.includes("asistente") && !esAdmin;
  const nombreUsuario = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : "";

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch<EquipoApiResponse>("/api/usuarios/equipos/");
      setEquipos(extraerEquipos(data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const recargar = () => cargar();

  const handleToggleSubLider = async (equipo: EquipoInfo, miembro: EquipoMiembroDetallado) => {
    const nuevoRol = miembro.rol_en_equipo === "SUB_LIDER" ? "MIEMBRO" : "SUB_LIDER";
    const key = `${equipo.id}-rol-${miembro.id_usuario}`;
    setAccionando(key);
    setMensaje(null);
    try {
      await apiFetch(`/api/usuarios/equipos/${equipo.id}/miembros/${miembro.id_usuario}/rol/`, {
        method: "POST",
        body: JSON.stringify({ rol_en_equipo: nuevoRol }),
      });
      setMensaje(nuevoRol === "SUB_LIDER" ? `Se otorgó SUB-LÍDER a ${miembro.nombres}` : `Se revocó SUB-LÍDER de ${miembro.nombres}`);
      await recargar();
    } catch (e) {
      setMensaje(`Error: ${(e as Error).message}`);
    } finally {
      setAccionando(null);
    }
  };

  const handleCambiarEstado = async (equipo: EquipoInfo, miembro: EquipoMiembroDetallado, estado: "ACTIVO" | "INACTIVO" | "INDISPONIBLE", extra?: { fecha_inicio?: string; fecha_fin?: string; motivo?: string }) => {
    const key = `${equipo.id}-estado-${miembro.id_usuario}-${estado}`;
    if (estado === "INACTIVO" && !confirm(`¿Inactivar a ${miembro.nombres} ${miembro.apellidos}? Esta es la forma de eliminar del equipo. Podrá reactivarse luego.`)) return;
    setAccionando(key);
    setMensaje(null);
    try {
      await apiFetch(`/api/usuarios/equipos/${equipo.id}/miembros/${miembro.id_usuario}/estado/`, {
        method: "POST",
        body: JSON.stringify({
          estado,
          fecha_inicio_indisponibilidad: extra?.fecha_inicio || undefined,
          fecha_fin_indisponibilidad: extra?.fecha_fin || undefined,
          motivo_indisponibilidad: extra?.motivo || undefined,
        }),
      });
      setMensaje(`Estado de ${miembro.nombres} cambiado a ${estado}`);
      await recargar();
    } catch (e) {
      setMensaje(`Error: ${(e as Error).message}`);
    } finally {
      setAccionando(null);
    }
  };

  const abrirModalIndisponible = (equipoId: number, miembro: EquipoMiembroDetallado) => {
    setFechaInicio(miembro.fecha_inicio_indisponibilidad ?? "");
    setFechaFin(miembro.fecha_fin_indisponibilidad ?? "");
    setMotivo(miembro.motivo_indisponibilidad ?? "");
    setModalIndisponible({ equipoId, miembro });
  };

  const confirmarIndisponible = async () => {
    if (!modalIndisponible) return;
    const equipo = equipos.find((e) => e.id === modalIndisponible.equipoId);
    if (!equipo) return;
    await handleCambiarEstado(equipo, modalIndisponible.miembro, "INDISPONIBLE", {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      motivo,
    });
    setModalIndisponible(null);
  };

  if (cargando) return <div style={{ padding: 16 }}>Cargando equipos…</div>;
  if (error) return <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, fontSize: 14 }}>Error al cargar equipos: {error}</div>;

  const badgeRol = (rol?: string | null) => {
    if (rol === "LIDER") return <span style={{ background: "#7c3aed", color: "white", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>LÍDER</span>;
    if (rol === "SUB_LIDER") return <span style={{ background: "#f59e0b", color: "white", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>SUB-LÍDER</span>;
    if (rol === "MIEMBRO") return <span style={{ background: "#e5e7eb", color: "#374151", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>MIEMBRO</span>;
    return null;
  };

  const badgeEstado = (estado: string) => {
    if (estado === "ACTIVO") return <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Activo</span>;
    if (estado === "INDISPONIBLE") return <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Indisponible</span>;
    if (estado === "INACTIVO") return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Inactivo</span>;
    return <span style={{ background: "#e5e7eb", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>{estado}</span>;
  };

  const esLiderDeEquipo = (equipo: EquipoInfo) => equipo.lider?.id === usuario?.id || esAdmin;
  // para mensaje de rol del usuario en cada equipo
  const esMiembroDeEquipo = (equipo: EquipoInfo) => equipo.miembros.some((m) => m.id_usuario === usuario?.id) || esLiderDeEquipo(equipo);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>Equipos</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            {esClientePuro
              ? "Ves los equipos a los que puedes solicitar servicios."
              : esAdmin
                ? "Vista administrador: ves todos los equipos del sistema."
                : "Pueder ver los equipos donde eres líder o integrante."}
          </p>
        </div>
        <button onClick={recargar} style={{ background: "#111827", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          Recargar
        </button>
      </div>

      {mensaje && (
        <div style={{ background: mensaje.startsWith("Error") ? "#fee2e2" : "#dcfce7", color: mensaje.startsWith("Error") ? "#991b1b" : "#166534", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
          {mensaje}
        </div>
      )}

      {esClientePuro && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 12, borderRadius: 8, fontSize: 13, color: "#1e40af" }}>
          Para crear una solicitud, elige uno de estos equipos en <Link href="/mfpages/cliente/mis-solicitudes" style={{ textDecoration: "underline", color: "#1d4ed8" }}>Mis Solicitudes</Link>.
        </div>
      )}

      {equipos.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            {esClientePuro ? "No hay equipos activos disponibles por el momento." : "No perteneces a ningún equipo aún."}
          </p>
          {!esClientePuro && <p style={{ color: "#9ca3af", fontSize: 12, margin: "8px 0 0" }}>Contacta a tu administrador para ser asignado a un equipo.</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {equipos.map((equipo) => {
            const expandido = equipoExpandido === equipo.id;
            const soyLider = equipo.lider?.id === usuario?.id || (esAdmin && equipo.puedo_gestionar);
            const puedoGestionar = Boolean(equipo.puedo_gestionar);
            const miRolLabel = equipo.mi_rol_en_equipo === "LIDER" ? "Líder" : equipo.mi_rol_en_equipo === "SUB_LIDER" ? "Sub-líder" : equipo.mi_rol_en_equipo === "MIEMBRO" ? "Miembro" : esClientePuro ? "Cliente (no miembro)" : esMiembroDeEquipo(equipo) ? "Integrante" : "—";
            const liderNombre = equipo.lider ? `${equipo.lider.nombres} ${equipo.lider.apellidos}` : "—";
            const totalActivos = equipo.miembros.filter((m) => m.estado === "ACTIVO").length;
            const totalIndisponibles = equipo.miembros.filter((m) => m.estado === "INDISPONIBLE").length;

            return (
              <div key={equipo.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div
                  onClick={() => setEquipoExpandido(expandido ? null : equipo.id)}
                  style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 12 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{equipo.nombre}</h3>
                      {!equipo.activo && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>Inactivo</span>}
                      {puedoGestionar ? (
                        <span style={{ background: "#ede9fe", color: "#6d28d9", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Puedes gestionar</span>
                      ) : equipo.mi_rol_en_equipo === "SUB_LIDER" ? (
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Eres Sub-líder</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>Líder: <strong style={{ color: "#111827" }}>{liderNombre}</strong></span>
                      <span>Miembros: {equipo.miembros.length} (activos {totalActivos}{totalIndisponibles ? `, indisponibles ${totalIndisponibles}` : ""})</span>
                      <span>Tu rol: <strong>{miRolLabel}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{expandido ? "Ocultar" : "Ver integrantes"}</span>
                    <span style={{ transform: expandido ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", fontSize: 12 }}>▼</span>
                  </div>
                </div>

                {expandido && (
                  <div style={{ borderTop: "1px solid #f3f4f6", padding: 16, background: "#fafafa" }}>
                    {/* Fila líder */}
                    <div style={{ marginBottom: 12, background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", gap: 8, alignItems: "center" }}>
                          {liderNombre} {badgeRol("LIDER")}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{equipo.lider?.email ?? ""} {equipo.lider?.cargo ? `• ${equipo.lider.cargo}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Líder del equipo</span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                        <thead>
                          <tr style={{ background: "#f9fafb", textAlign: "left", fontSize: 12, color: "#6b7280" }}>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Integrante</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Email</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Rol en equipo</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Estado</th>
                            {puedoGestionar && <th style={{ padding: "10px 12px", fontWeight: 600, minWidth: 220 }}>Acciones (solo líder)</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {equipo.miembros.length === 0 ? (
                            <tr>
                              <td colSpan={puedoGestionar ? 5 : 4} style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                                Sin integrantes adicionales (solo líder)
                              </td>
                            </tr>
                          ) : (
                            equipo.miembros.map((m) => {
                              const esYo = m.id_usuario === usuario?.id;
                              return (
                                <tr key={m.id} style={{ borderTop: "1px solid #f3f4f6", fontSize: 13, background: m.estado === "INACTIVO" ? "#fef2f2" : m.estado === "INDISPONIBLE" ? "#fffbeb" : "white", opacity: m.estado === "INACTIVO" ? 0.7 : 1 }}>
                                  <td style={{ padding: "10px 12px" }}>
                                    <div style={{ fontWeight: 600, color: "#111827" }}>
                                      {m.nombres} {m.apellidos} {esYo && <span style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 999, fontSize: 11, marginLeft: 6 }}>Tú</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>{m.cargo || "—"}</div>
                                    {m.estado === "INDISPONIBLE" && (m.fecha_inicio_indisponibilidad || m.motivo_indisponibilidad) && (
                                      <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
                                        {m.motivo_indisponibilidad ? `Motivo: ${m.motivo_indisponibilidad}` : ""}
                                        {m.fecha_inicio_indisponibilidad ? ` • ${m.fecha_inicio_indisponibilidad}` : ""}
                                        {m.fecha_fin_indisponibilidad ? ` → ${m.fecha_fin_indisponibilidad}` : ""}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "10px 12px", color: "#374151", fontSize: 12 }}>{m.email}</td>
                                  <td style={{ padding: "10px 12px" }}>{badgeRol(m.rol_en_equipo)}</td>
                                  <td style={{ padding: "10px 12px" }}>{badgeEstado(m.estado)}</td>
                                  {puedoGestionar && (
                                    <td style={{ padding: "8px 12px" }}>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <button
                                          onClick={() => handleToggleSubLider(equipo, m)}
                                          disabled={!!accionando || m.estado !== "ACTIVO"}
                                          title={m.estado !== "ACTIVO" ? "Solo miembros activos pueden ser sub-líder" : soyLider ? "Otorgar/revocar SUB-LÍDER" : "Solo el líder puede hacer esto"}
                                          style={{
                                            background: m.rol_en_equipo === "SUB_LIDER" ? "#fef3c7" : "white",
                                            color: m.rol_en_equipo === "SUB_LIDER" ? "#92400e" : "#374151",
                                            border: `1px solid ${m.rol_en_equipo === "SUB_LIDER" ? "#f59e0b" : "#d1d5db"}`,
                                            padding: "4px 8px",
                                            borderRadius: 6,
                                            cursor: m.estado !== "ACTIVO" ? "not-allowed" : "pointer",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            opacity: m.estado !== "ACTIVO" ? 0.5 : 1,
                                          }}
                                        >
                                          {accionando === `${equipo.id}-rol-${m.id_usuario}` ? "…" : m.rol_en_equipo === "SUB_LIDER" ? "Revocar sub-líder" : "Hacer sub-líder"}
                                        </button>

                                        {m.estado !== "INACTIVO" ? (
                                          <button
                                            onClick={() => handleCambiarEstado(equipo, m, "INACTIVO")}
                                            disabled={!!accionando}
                                            style={{ background: "white", color: "#991b1b", border: "1px solid #fecaca", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                                          >
                                            Inactivar
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleCambiarEstado(equipo, m, "ACTIVO")}
                                            disabled={!!accionando}
                                            style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                                          >
                                            Reactivar
                                          </button>
                                        )}

                                        {m.estado !== "INDISPONIBLE" ? (
                                          <button
                                            onClick={() => abrirModalIndisponible(equipo.id, m)}
                                            disabled={!!accionando || m.estado === "INACTIVO"}
                                            style={{ background: "white", color: "#92400e", border: "1px solid #fde68a", padding: "4px 8px", borderRadius: 6, cursor: m.estado === "INACTIVO" ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600, opacity: m.estado === "INACTIVO" ? 0.5 : 1 }}
                                          >
                                            Indisponible
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleCambiarEstado(equipo, m, "ACTIVO")}
                                            disabled={!!accionando}
                                            style={{ background: "white", color: "#166534", border: "1px solid #86efac", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                                          >
                                            Volver a activo
                                          </button>
                                        )}
                                      </div>
                                      {!soyLider && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Gestionar miembros requiere ser líder</div>}
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!puedoGestionar && equipo.miembros.length > 0 && (
                      <div style={{ marginTop: 12, padding: 10, background: "#f3f4f6", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>
                        {equipo.mi_rol_en_equipo === "SUB_LIDER"
                          ? "Eres sub-líder: puedes aprobar, iniciar y gestionar tareas del equipo, pero no administrar roles/estados."
                          : esClientePuro
                            ? ""
                            : "Vista integrante: ves la información básica de tus compañeros. Solo el líder puede administrar roles y estados."}
                      </div>
                    )}

                    {puedoGestionar && (
                      <div style={{ marginTop: 12, padding: 10, background: "#ede9fe", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 12, color: "#5b21b6" }}>
                        <strong>Como líder puedes:</strong> otorgar/revocar <em>SUB-LÍDER, o cambiar disponibilidad de los miembros del equipo</em>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal indisponibilidad */}
      {modalIndisponible && (
        <div
          onClick={() => setModalIndisponible(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 480, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Marcar indisponible</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
              {modalIndisponible.miembro.nombres} {modalIndisponible.miembro.apellidos} — se usará como vacaciones/indisponibilidad temporal.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Fecha inicio
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Fecha fin
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Motivo
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Vacaciones, licencia médica…" style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalIndisponible(null)} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={confirmarIndisponible} style={{ background: "#f59e0b", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Confirmar indisponible</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
