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

type Pendiente = { subtarea_id: number; descripcion: string; tarea_id: number; tarea_asunto: string; estado: string };

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

  // modal reasignar por indisponibilidad bloqueada (409) — también para baja INACTIVO
  const [modalReasignar, setModalReasignar] = useState<{
    equipo: EquipoInfo;
    miembro: EquipoMiembroDetallado;
    pendientes: Pendiente[];
    usuarioNombre: string;
    extra: { fechaInicio: string; fechaFin: string; motivo: string; esBaja: boolean };
  } | null>(null);
  const [reassignments, setReassignments] = useState<Record<number, number>>({});
  // modal agregar miembro (INACTIVO hard-delete -> re-agregar como MIEMBRO)
  const [modalAgregar, setModalAgregar] = useState<EquipoInfo | null>(null);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<{ id: number; email: string; nombres: string; apellidos: string }[]>([]);
  const [agregarUsuarioId, setAgregarUsuarioId] = useState<string>("");

  const usuario = getUsuarioActual();
  const roles = (usuario?.roles ?? []).map((r) => r.toLowerCase());
  const esAdmin = roles.includes("administrador");
  const esClientePuro = roles.includes("cliente") && !roles.includes("asignador") && !roles.includes("asistente") && !esAdmin;

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
    if (miembro.rol_en_equipo === "LIDER") return;
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

  const handleCambiarEstado = async (equipo: EquipoInfo, miembro: EquipoMiembroDetallado, estado: "ACTIVO" | "INACTIVO" | "INDISPONIBLE", extra?: { fecha_inicio?: string; fecha_fin?: string; motivo?: string; reassignments?: { subtarea_id: number; nuevo_asignado: number }[] }) => {
    const key = `${equipo.id}-estado-${miembro.id_usuario}-${estado}`;
    if (estado === "INACTIVO" && !confirm(`¿Dar de baja a ${miembro.nombres} ${miembro.apellidos}? Ya no pertenecerá al equipo hasta que lo vuelvas a agregar (forzosamente como MIEMBRO). Si tiene subtareas en desarrollo/en espera, deberás reasignarlas.`)) return;
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
          reassignments: extra?.reassignments || undefined,
        }),
      });
      setMensaje(`Estado de ${miembro.nombres} cambiado a ${estado}`);
      await recargar();
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      // Intentar parsear respuesta 409 con pendientes
      // apiFetch lanza Error con message JSON; intentar extraer pendientes si viene en formato 409
      // Si el mensaje contiene "pendientes" intentamos mostrar modal
      let data: any = null;
      try {
        // si el error viene de apiFetch que incluye body json en message, intentar parsear
        // fallback: hacer fetch crudo para obtener detalle
        data = JSON.parse(msg);
      } catch { }
      // Si no se parseó, el mensaje puede ser el detail simple
      // Forzamos segundo intento: intentar extraer del mensaje de error por si contiene "subtareas pendientes"
      if (msg.includes("subtareas pendientes") || msg.includes("pendientes")) {
        // Tratar de obtener detalle vía endpoint subtareas-pendientes para mostrar modal genérico
        try {
          const detalle = await apiFetch<any>(`/api/usuarios/equipos/${equipo.id}/miembros/${miembro.id_usuario}/subtareas-pendientes/`);
          if (detalle && detalle.pendientes && detalle.pendientes.length > 0) {
            const pendientes: Pendiente[] = detalle.pendientes.map((p: any) => ({
              subtarea_id: p.subtarea_id,
              descripcion: p.descripcion,
              tarea_id: p.tarea_id,
              tarea_asunto: p.tarea_asunto,
              estado: p.estado,
            }));
            setModalReasignar({
              equipo,
              miembro,
              pendientes,
              usuarioNombre: `${miembro.nombres} ${miembro.apellidos}`,
              extra: { fechaInicio: extra?.fecha_inicio ?? "", fechaFin: extra?.fecha_fin ?? "", motivo: extra?.motivo ?? "", esBaja: estado === "INACTIVO" },
            });
            setReassignments({});
            setMensaje(msg);
            return false;
          }
        } catch { }
      }
      // Si el error fue 409 con data.pendientes, usar directamente si pudimos parsear
      if (data && data.pendientes) {
        setModalReasignar({
          equipo,
          miembro,
          pendientes: data.pendientes,
          usuarioNombre: data.usuario?.nombre ?? `${miembro.nombres} ${miembro.apellidos}`,
          extra: { fechaInicio: extra?.fecha_inicio ?? "", fechaFin: extra?.fecha_fin ?? "", motivo: extra?.motivo ?? "", esBaja: estado === "INACTIVO" },
        });
        setReassignments({});
      }
      setMensaje(`Error: ${msg}`);
      return false;
    } finally {
      setAccionando(null);
    }
  };

  // Wrapper que intercepta 409 para abrir modal reasignar (también para INACTIVO hard-delete)
  const handleCambiarEstadoConReasignacion = async (equipo: EquipoInfo, miembro: EquipoMiembroDetallado, estado: "ACTIVO" | "INACTIVO" | "INDISPONIBLE", extra?: { fecha_inicio?: string; fecha_fin?: string; motivo?: string }) => {
    const key = `${equipo.id}-estado-${miembro.id_usuario}-${estado}`;
    if (estado === "INACTIVO" && !confirm(`¿Dar de baja a ${miembro.nombres} ${miembro.apellidos}? Ya no pertenecerá hasta que lo vuelvas a agregar.`)) return;
    setAccionando(key);
    setMensaje(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken") : null;
      // usar apiFetch pero capturar error 409 con detalle
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
    } catch (e: any) {
      const raw = (e as Error).message;
      // apiFetch lanza con message = detail o JSON stringify; intentar detectar 409
      // Hacer intento directo con fetch para obtener JSON completo si apiFetch ocultó detalle
      let shouldOpenModal = raw.includes("pendientes") || raw.includes("reasign");
      if (shouldOpenModal) {
        try {
          const detalle = await apiFetch<any>(`/api/usuarios/equipos/${equipo.id}/miembros/${miembro.id_usuario}/subtareas-pendientes/`);
          const pendientes: Pendiente[] = (detalle.pendientes ?? []).map((p: any) => ({
            subtarea_id: p.subtarea_id,
            descripcion: p.descripcion,
            tarea_id: p.tarea_id,
            tarea_asunto: p.tarea_asunto,
            estado: p.estado,
          }));
          if (pendientes.length > 0) {
            setModalReasignar({
              equipo,
              miembro,
              pendientes,
              usuarioNombre: `${miembro.nombres} ${miembro.apellidos}`,
              extra: { fechaInicio: extra?.fecha_inicio ?? "", fechaFin: extra?.fecha_fin ?? "", motivo: extra?.motivo ?? "", esBaja: estado === "INACTIVO" },
            });
            setReassignments({});
            setMensaje(`Error: ${raw} — el siguiente usuario tiene subtareas pendientes, estas deben completarse o re-asignarse`);
            setAccionando(null);
            return;
          }
        } catch { }
      }
      setMensaje(`Error: ${raw}`);
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
    setModalIndisponible(null);
    await handleCambiarEstadoConReasignacion(equipo, modalIndisponible.miembro, "INDISPONIBLE", {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      motivo,
    });
  };

  const confirmarReasignarYMarcar = async () => {
    if (!modalReasignar) return;
    const { equipo, miembro, pendientes, extra } = modalReasignar;
    const reassignList = pendientes.map((p) => ({
      subtarea_id: p.subtarea_id,
      nuevo_asignado: reassignments[p.subtarea_id],
    }));
    const sinAsignar = reassignList.filter((r) => !r.nuevo_asignado);
    if (sinAsignar.length > 0) {
      setMensaje(extra.esBaja ? "Error: debes reasignar todas las subtareas antes de dar de baja." : "Error: debes reasignar todas las subtareas pendientes antes de marcar indisponible.");
      return;
    }
    const estadoFinal = extra.esBaja ? "INACTIVO" : "INDISPONIBLE";
    const ok = await handleCambiarEstado(equipo, miembro, estadoFinal as any, {
      fecha_inicio: extra.fechaInicio,
      fecha_fin: extra.fechaFin,
      motivo: extra.motivo,
      reassignments: reassignList as any,
    });
    if (ok) setModalReasignar(null);
  };

  const abrirModalAgregar = async (equipo: EquipoInfo) => {
    setMensaje(null);
    setAgregarUsuarioId("");
    setModalAgregar(equipo);
    try {
      const data = await apiFetch<any>("/api/usuarios/usuarios/");
      const lista = Array.isArray(data) ? data : (data.results ?? data);
      // filtrar los que ya son miembros o líder
      const miembrosIds = new Set(equipo.miembros.map((m) => m.id_usuario));
      miembrosIds.add(equipo.lider?.id as number);
      const disponibles = (lista as any[]).filter((u) => !miembrosIds.has(u.id) && u.activo !== false);
      setUsuariosDisponibles(disponibles);
    } catch (e) {
      setMensaje(`Error cargando usuarios: ${(e as Error).message}`);
      setUsuariosDisponibles([]);
    }
  };

  const confirmarAgregar = async () => {
    if (!modalAgregar || !agregarUsuarioId) {
      setMensaje("Error: selecciona un usuario para agregar.");
      return;
    }
    setAccionando(`agregar-${modalAgregar.id}`);
    try {
      await apiFetch(`/api/usuarios/equipos/${modalAgregar.id}/miembros/`, {
        method: "POST",
        body: JSON.stringify({ usuario_id: Number(agregarUsuarioId) }),
      });
      setMensaje("Miembro agregado como MIEMBRO.");
      setModalAgregar(null);
      await recargar();
    } catch (e) {
      setMensaje(`Error: ${(e as Error).message}`);
    } finally {
      setAccionando(null);
    }
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
                : "Puedes ver los equipos donde eres líder o integrante."}
          </p>
        </div>
        <button onClick={recargar} style={{ background: "#111827", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          Recargar
        </button>
      </div>

      {mensaje && (
        <div style={{ background: mensaje.startsWith("Error") ? "#fee2e2" : "#dcfce7", color: mensaje.startsWith("Error") ? "#991b1b" : "#166534", padding: "10px 12px", borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>
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
            const miRolLabel = equipo.mi_rol_en_equipo === "LIDER" ? "Líder" : equipo.mi_rol_en_equipo === "SUB_LIDER" ? "Sub-líder" : equipo.mi_rol_en_equipo === "MIEMBRO" ? "Miembro" : esClientePuro ? "" : "—";
            const liderNombre = equipo.lider ? `${equipo.lider.nombres} ${equipo.lider.apellidos}` : "—";
            const totalActivos = equipo.miembros.filter((m) => m.estado === "ACTIVO").length;
            const totalIndisponibles = equipo.miembros.filter((m) => m.estado === "INDISPONIBLE").length;
            const tieneSubLiderActivo = equipo.miembros.some((m) => m.rol_en_equipo === "SUB_LIDER" && m.estado === "ACTIVO");
            const liderMiembro = equipo.miembros.find((m) => m.id_usuario === equipo.lider?.id);

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
                      {!esClientePuro && (

                        <span>Tu rol: <strong>{miRolLabel}</strong></span>

                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{expandido ? "Ocultar" : "Ver integrantes"}</span>
                    <span style={{ transform: expandido ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", fontSize: 12 }}>▼</span>
                  </div>
                </div>

                {expandido && (
                  <div style={{ borderTop: "1px solid #f3f4f6", padding: 16, background: "#fafafa" }}>
                    {/* Fila líder con disponibilidad */}
                    <div style={{ marginBottom: 12, background: "white", border: `1px solid ${liderMiembro?.estado === "INDISPONIBLE" ? "#f59e0b" : "#e5e7eb"}`, borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", gap: 8, alignItems: "center" }}>
                          {liderNombre} {badgeRol("LIDER")} {liderMiembro && badgeEstado(liderMiembro.estado)}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{equipo.lider?.email ?? ""} {equipo.lider?.cargo ? `• ${equipo.lider.cargo}` : ""}</div>
                        {liderMiembro?.estado === "INDISPONIBLE" && (liderMiembro.fecha_inicio_indisponibilidad || liderMiembro.motivo_indisponibilidad) && (
                          <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
                            {liderMiembro.motivo_indisponibilidad ? `Motivo: ${liderMiembro.motivo_indisponibilidad}` : ""}
                            {liderMiembro.fecha_inicio_indisponibilidad ? ` • ${liderMiembro.fecha_inicio_indisponibilidad}` : ""}
                            {liderMiembro.fecha_fin_indisponibilidad ? ` → ${liderMiembro.fecha_fin_indisponibilidad}` : ""}
                          </div>
                        )}
                      </div>
                      {soyLider &&
                        <>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {liderMiembro && liderMiembro.estado !== "INDISPONIBLE" ? (
                              <button
                                onClick={() => {
                                  if (!tieneSubLiderActivo) { setMensaje("Error: No puedes marcar al líder como indisponible si no hay un sub-líder activo."); return; }
                                  abrirModalIndisponible(equipo.id, liderMiembro);
                                }}
                                disabled={!!accionando || !tieneSubLiderActivo}
                                title={!tieneSubLiderActivo ? "Debe haber un sub-líder activo para que el líder pueda marcarse indisponible (condición)" : "Inactivar cuenta"}
                                style={{ background: tieneSubLiderActivo ? "white" : "#f3f4f6", color: tieneSubLiderActivo ? "#92400e" : "#9ca3af", border: "1px solid #fde68a", padding: "6px 10px", borderRadius: 6, cursor: tieneSubLiderActivo ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}
                              >
                                Inactivar cuenta
                              </button>
                            ) : liderMiembro ? (
                              <button
                                onClick={() => handleCambiarEstado(equipo, liderMiembro, "ACTIVO")}
                                disabled={!!accionando}
                                style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                              >
                                Volver líder a activo
                              </button>
                            ) : null}
                            <span style={{ fontSize: 11, color: "#6b7280" }}>Condición: debe haber sub-líder</span>
                          </div>
                        </>
                      }
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                        <thead>
                          <tr style={{ background: "#f9fafb", textAlign: "left", fontSize: 12, color: "#6b7280" }}>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Integrante</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Email</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Rol en equipo</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Estado</th>
                            {puedoGestionar && <th style={{ padding: "10px 12px", fontWeight: 600, minWidth: 260 }}>Acciones (solo líder)</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {equipo.miembros.filter((m) => m.rol_en_equipo !== "LIDER").length === 0 ? (
                            <tr>
                              <td colSpan={puedoGestionar ? 5 : 4} style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                                Sin integrantes adicionales (solo líder)
                              </td>
                            </tr>
                          ) : (
                            equipo.miembros.filter((m) => m.rol_en_equipo !== "LIDER").map((m) => {
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

                                        <button
                                          onClick={() => handleCambiarEstadoConReasignacion(equipo, m, "INACTIVO")}
                                          disabled={!!accionando}
                                          title="ELIMINAR DEL GRUPO: ya no pertenecerá hasta re-agregarse como MIEMBRO. Si tiene subtareas pendientes, deberás reasignarlas."
                                          style={{ background: "white", color: "#991b1b", border: "1px solid #fecaca", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                                        >
                                          Eliminar del grupo
                                        </button>

                                        {m.estado !== "INDISPONIBLE" ? (
                                          <button
                                            onClick={() => abrirModalIndisponible(equipo.id, m)}
                                            disabled={!!accionando || m.estado === "INACTIVO"}
                                            style={{ background: "white", color: "#92400e", border: "1px solid #fde68a", padding: "4px 8px", borderRadius: 6, cursor: m.estado === "INACTIVO" ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600, opacity: m.estado === "INACTIVO" ? 0.5 : 1 }}
                                          >
                                            Inactivar
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
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {puedoGestionar && (
                      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          onClick={() => abrirModalAgregar(equipo)}
                          disabled={!!accionando}
                          style={{ background: "#111827", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                        >
                          + Agregar integrante
                        </button>
                      </div>
                    )}
                    {puedoGestionar && (
                      <div style={{ marginTop: 8, padding: 10, background: "#ede9fe", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 12, color: "#5b21b6" }}>
                        <strong>Como líder puedes:</strong> otorgar/revocar SUB-LÍDER, dar de baja (hard-delete), y cambiar disponibilidad (incluida la tuya si hay sub-líder) reasignando subtareas en desarrollo/en espera.
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
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Inactivar cuenta {modalIndisponible.miembro.rol_en_equipo === "LIDER" ? "(Líder - requiere sub-líder)" : ""}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
              {modalIndisponible.miembro.nombres} {modalIndisponible.miembro.apellidos} — se inactivará temporalmente. Si tiene subtareas en desarrollo/en espera, deberás reasignarlas.
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
              <button onClick={confirmarIndisponible} style={{ background: "#f59e0b", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Inactivar cuenta</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reasignar pendientes bloqueado */}
      {modalReasignar && (
        <div
          onClick={() => setModalReasignar(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#991b1b" }}>Subtareas pendientes — reasignación requerida</h3>
            <p style={{ margin: "6px 0 12px", fontSize: 13, color: "#374151", background: "#fee2e2", padding: 10, borderRadius: 8 }}>
              el siguiente usuario tiene subtareas pendientes, estas deben completarse o re-asignarse: <strong>{modalReasignar.usuarioNombre}</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {modalReasignar.pendientes.map((p) => {
                const opciones = modalReasignar.equipo.miembros.filter((m) => m.estado === "ACTIVO" && m.id_usuario !== modalReasignar.miembro.id_usuario);
                return (
                  <div key={p.subtarea_id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#fafafa" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.descripcion}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Tarea #{p.tarea_id} — {p.tarea_asunto} • Estado: {p.estado}</div>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600 }}>
                      Reasignar a:
                      <select
                        value={reassignments[p.subtarea_id] ?? ""}
                        onChange={(e) => setReassignments((prev) => ({ ...prev, [p.subtarea_id]: Number(e.target.value) }))}
                        style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                      >
                        <option value="">— seleccionar —</option>
                        {opciones.map((o) => (
                          <option key={o.id_usuario} value={o.id_usuario}>
                            {o.nombres} {o.apellidos} ({o.rol_en_equipo}) — {o.estado}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => setModalReasignar(null)} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cerrar</button>
              <button onClick={confirmarReasignarYMarcar} style={{ background: "#7c3aed", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {modalReasignar.extra.esBaja ? "Reasignar y dar de baja" : "Reasignar e inactivar esta cuenta"}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>Puedes reasignar todas a una misma persona seleccionando el mismo destino. Las subtareas deben reasignarse a miembros con estado ACTIVO.</div>
          </div>
        </div>
      )}

      {/* Modal agregar integrante (re-agregar tras baja hard-delete) */}
      {modalAgregar && (
        <div
          onClick={() => setModalAgregar(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 520, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Agregar integrante</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
              Selecciona el nuevo miembro para que forme parte del equipo
            </p>
            {usuariosDisponibles.length === 0 ? (
              <div style={{ background: "#fef3c7", padding: 10, borderRadius: 8, fontSize: 13, color: "#92400e" }}>No hay usuarios disponibles para agregar (todos ya son miembros o no hay usuarios activos).</div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Selecciona usuario
                <select
                  value={agregarUsuarioId}
                  onChange={(e) => setAgregarUsuarioId(e.target.value)}
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                >
                  <option value="">— seleccionar —</option>
                  {usuariosDisponibles.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.nombres} {u.apellidos} — {u.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalAgregar(null)} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={confirmarAgregar}
                disabled={!agregarUsuarioId || !!accionando}
                style={{ background: agregarUsuarioId ? "#111827" : "#9ca3af", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: agregarUsuarioId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600 }}
              >
                Agregar como MIEMBRO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
