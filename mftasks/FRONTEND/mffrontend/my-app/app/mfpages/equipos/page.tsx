"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo, EquipoMiembroDetallado } from "@/lib/types";
import styles from "./Equipos.module.css";

type EquipoApiResponse = EquipoInfo[] | { results: EquipoInfo[] };

function extraerEquipos(data: EquipoApiResponse): EquipoInfo[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) return (data as { results: EquipoInfo[] }).results ?? [];
  return [];
}

type Pendiente = { subtarea_id: number; descripcion: string; tarea_id: number; tarea_asunto: string; estado: string };

type UsuarioLista = { id: number; codigo?: string; email: string; nombres: string; apellidos: string; roles?: string[]; is_active?: boolean; activo?: boolean };

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
  // modal agregar miembro
  const [modalAgregar, setModalAgregar] = useState<EquipoInfo | null>(null);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<{ id: number; codigo?: string; email: string; nombres: string; apellidos: string; is_active?: boolean; activo?: boolean; roles?: string[] }[]>([]);
  const [agregarUsuarioId, setAgregarUsuarioId] = useState<string>("");
  const [busquedaUsuario, setBusquedaUsuario] = useState<string>("");
  // modal crear equipo
  const [modalCrear, setModalCrear] = useState(false);
  // modal asignar aprobadores
  const [modalAprobadores, setModalAprobadores] = useState<EquipoInfo | null>(null);
  const [usuariosTodos, setUsuariosTodos] = useState<UsuarioLista[]>([]);
  const [aprobadoresSel, setAprobadoresSel] = useState<{ GERENTE: string; SUBGERENTE: string; JEFE: string }>({ GERENTE: "", SUBGERENTE: "", JEFE: "" });

  const usuario = getUsuarioActual();
  const roles = (usuario?.roles ?? []).map((r) => r.toLowerCase());
  const esAdmin = roles.includes("administrador");
  const esClientePuro = roles.includes("cliente") && !esAdmin && !roles.includes("miembro") && !roles.includes("asignador") && !roles.includes("asistente");
  const puedeCrearEquipo = esAdmin;
  const [soloMios, setSoloMios] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");

  const esMiEquipo = (equipo: EquipoInfo) =>
    equipo.lider?.id === usuario?.id ||
    (equipo.miembros ?? []).some((m) => m.id_usuario === usuario?.id);

  const equiposVisibles = equipos
    .filter((e) => !soloMios || esMiEquipo(e))
    .filter((e) => filtroTipo === "TODOS" || (e.tipo_equipo ?? "GTR") === filtroTipo);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    lider: "",
  });


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
      setMensaje(
        estado === "INACTIVO"
          ? `${miembro.nombres} ${miembro.apellidos} fue eliminado del equipo.`
          : `Estado de ${miembro.nombres} cambiado a ${estado}`
      );
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
    setBusquedaUsuario("");
    setModalAgregar(equipo);
    try {
      const data = await apiFetch<any>("/api/usuarios/usuarios/");
      const lista = Array.isArray(data) ? data : (data.results ?? data);
      // filtrar los que ya son miembros o líder, y exigir el rol requerido por el tipo de equipo
      const miembrosIds = new Set(equipo.miembros.map((m) => m.id_usuario));
      miembrosIds.add(equipo.lider?.id as number);
      const requerido = (equipo.rol_integrante_requerido ?? "MIEMBRO").toUpperCase();
      const disponibles = (lista as any[]).filter((u) =>
        !miembrosIds.has(u.id) &&
        (u.is_active ?? u.activo) !== false &&
        ((u.roles ?? []) as string[]).map((r) => r.toUpperCase()).includes(requerido)
      );
      setUsuariosDisponibles(disponibles);
    } catch (e) {
      setMensaje(`Error cargando usuarios: ${(e as Error).message}`);
      setUsuariosDisponibles([]);
    }
  };

  const confirmarAgregar = async () => {
    if (!modalAgregar || !agregarUsuarioId.trim()) {
      setMensaje("Error: ingresa el código MFS- del usuario (ej. MFS-20250101-12345).");
      return;
    }
    const esCodigo = agregarUsuarioId.trim().toUpperCase().startsWith("MFS-");
    setAccionando(`agregar-${modalAgregar.id}`);
    try {
      const payload = esCodigo ? { codigo: agregarUsuarioId.trim().toUpperCase() } : { usuario_id: Number(agregarUsuarioId) };
      await apiFetch(`/api/usuarios/equipos/${modalAgregar.id}/miembros/`, {
        method: "POST",
        body: JSON.stringify(payload),
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

  const abrirModalAprobadores = async (equipo: EquipoInfo) => {
    setMensaje(null);
    const inicial = { GERENTE: "", SUBGERENTE: "", JEFE: "" } as { GERENTE: string; SUBGERENTE: string; JEFE: string };
    for (const a of equipo.aprobadores ?? []) {
      const rol = a.rol_aprobador.toUpperCase() as keyof typeof inicial;
      if (rol in inicial) inicial[rol] = a.usuario.codigo ?? String(a.usuario.id);
    }
    setAprobadoresSel(inicial);
    setModalAprobadores(equipo);
    try {
      const data = await apiFetch<UsuarioLista[] | { results: UsuarioLista[] }>("/api/usuarios/usuarios/");
      const lista = Array.isArray(data) ? data : data.results ?? [];
      setUsuariosTodos(lista.filter((u) => (u.is_active ?? u.activo) !== false));
    } catch (e) {
      setMensaje(`Error cargando usuarios: ${(e as Error).message}`);
      setUsuariosTodos([]);
    }
  };

  const usuariosPorRol = (rol: string) =>
    usuariosTodos.filter((u) =>
      ((u.roles ?? []) as string[]).map((r) => r.toUpperCase()).includes(rol)
    );

  const confirmarAprobadores = async () => {
    if (!modalAprobadores) return;
    const faltan = (["GERENTE", "SUBGERENTE", "JEFE"] as const).filter((r) => !aprobadoresSel[r]);
    if (faltan.length > 0) {
      setMensaje(`Error: debes asignar un aprobador por rol. Faltan: ${faltan.join(", ")}.`);
      return;
    }
    setAccionando(`aprobadores-${modalAprobadores.id}`);
    setMensaje(null);
    try {
      await apiFetch(`/api/usuarios/equipos/${modalAprobadores.id}/aprobadores/`, {
        method: "POST",
        body: JSON.stringify({
          aprobadores: (["GERENTE", "SUBGERENTE", "JEFE"] as const).map((rol) => ({
            rol,
            codigo: aprobadoresSel[rol],
          })),
        }),
      });
      setMensaje("Aprobadores actualizados correctamente.");
      setModalAprobadores(null);
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

  const claseTipo = (tipo?: string | null) => {
    if (tipo === "GERENTE") return styles.tipoGerente;
    if (tipo === "SUBGERENTE") return styles.tipoSubgerente;
    if (tipo === "JEFE") return styles.tipoJefe;
    return styles.tipoGtr;
  };

  const crearEquipo = async () => {
    const nombre = nuevo.nombre.trim();
    const codigoLider = nuevo.lider.trim().toUpperCase();

    if (!nombre) {
      setMensaje("El nombre del equipo es obligatorio.");
      return;
    }

    // El admin puede designar cualquier líder elegible; el resto crea su propio equipo.
    if (esAdmin && !codigoLider) {
      setMensaje("El código del líder es obligatorio.");
      return;
    }

    try {
      setMensaje(null);

      const body: { nombre: string; lider?: string } = { nombre };
      if (esAdmin) {
        body.lider = codigoLider;
      }

      await apiFetch("/api/usuarios/equipos/", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMensaje(`Equipo "${nombre}" creado correctamente.`);
      setModalCrear(false);

      setNuevo({
        nombre: "",
        lider: "",
      });

      await recargar();

    } catch (e) {
      setMensaje(`Error al crear el equipo: ${(e as Error).message}`);
    }
  };

  const usuariosFiltrados = usuariosDisponibles.filter((u) => {
    const q = busquedaUsuario.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nombres.toLowerCase().includes(q) ||
      u.apellidos.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.codigo ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className={styles.pageTitle}>Equipos</h2>
          <p className={styles.pageSubtitle}>
            {esClientePuro
              ? "Ves los equipos a los que puedes solicitar servicios."
              : esAdmin
                ? "Vista administrador: ves todos los equipos del sistema."
                : "Ves todos los equipos del sistema; usa el filtro para ver solo aquellos a los que perteneces."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {puedeCrearEquipo && !esClientePuro && (
            <button
              onClick={() => { setNuevo({ nombre: "", lider: "" }); setMensaje(null); setModalCrear(true); }}
              style={{ background: "#7c3aed", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Crear equipo
            </button>
          )}
          <button onClick={recargar} style={{ background: "#111827", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            Recargar
          </button>
        </div>
      </div>

      {!esClientePuro && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSoloMios((v) => !v)}
            style={{
              border: "1px solid #d1d5db",
              background: soloMios ? "#111827" : "white",
              color: soloMios ? "white" : "#374151",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {soloMios ? "Filtro: solo mis equipos" : "Filtro: todos los equipos"}
          </button>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{
              border: "1px solid #d1d5db",
              background: "white",
              color: "#374151",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="TODOS">Todos los tipos</option>
            <option value="GERENTE">Equipo de Gerente</option>
            <option value="SUBGERENTE">Equipo de Subgerente</option>
            <option value="JEFE">Equipo de Jefe</option>
            <option value="GTR">Equipo GTR</option>
          </select>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            {equiposVisibles.length} de {equipos.length} equipo(s)
          </span>
        </div>
      )}

      {mensaje && (
        <div className={`${styles.alert} ${mensaje.startsWith("Error") ? styles.alertError : styles.alertSuccess}`}>
          {mensaje}
        </div>
      )}




      {esClientePuro && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 12, borderRadius: 8, fontSize: 13, color: "#1e40af" }}>
          Para crear una solicitud, elige uno de estos equipos en <Link href="/mfpages/cliente/mis-solicitudes" style={{ textDecoration: "underline", color: "#1d4ed8" }}>Mis Solicitudes</Link>.
        </div>
      )}

      {equiposVisibles.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            {soloMios
              ? "No perteneces a ningún equipo aún."
              : filtroTipo !== "TODOS"
                ? "No hay equipos de ese tipo."
                : esClientePuro
                  ? "No hay equipos activos disponibles por el momento."
                  : "No hay equipos disponibles."}
          </p>
          {!esClientePuro && !soloMios && <p style={{ color: "#9ca3af", fontSize: 12, margin: "8px 0 0" }}>Contacta a tu administrador para ser asignado a un equipo.</p>}
        </div>
      ) : (
        <div className={styles.grid}>
          {equiposVisibles.map((equipo) => {
            const expandido = equipoExpandido === equipo.id;
            const soyLider = equipo.lider?.id === usuario?.id || (esAdmin && equipo.puedo_gestionar);
            const miRolLabel = equipo.mi_rol_en_equipo === "LIDER" ? "Líder" : equipo.mi_rol_en_equipo === "SUB_LIDER" ? "Sub-líder" : equipo.mi_rol_en_equipo === "MIEMBRO" ? "Miembro" : esClientePuro ? "" : "—";
            const liderNombre = equipo.lider ? `${equipo.lider.nombres} ${equipo.lider.apellidos}` : "—";
            const totalActivos = equipo.miembros.filter((m) => m.estado === "ACTIVO").length;
            const totalIndisponibles = equipo.miembros.filter((m) => m.estado === "INDISPONIBLE").length;
            const tieneSubLiderActivo = equipo.miembros.some((m) => m.rol_en_equipo === "SUB_LIDER" && m.estado === "ACTIVO");
            const liderMiembro = equipo.miembros.find((m) => m.id_usuario === equipo.lider?.id);
            const liderActivo = liderMiembro?.estado === "ACTIVO";
            const puedoGestionar = Boolean(equipo.puedo_gestionar) && liderActivo;


            return (
              <div key={equipo.id} className={styles.card}>
                <div
                  onClick={() => setEquipoExpandido(expandido ? null : equipo.id)}
                  className={`${styles.cardHeader} ${claseTipo(equipo.tipo_equipo)}`}
                >
                  <div className={styles.cardHeaderLeft}>
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle}>{equipo.nombre}</h3>
                      {equipo.tipo_equipo && (
                        <span className={`${styles.badge} ${styles.badgeTipo}`}>
                          {equipo.tipo_equipo === "GERENTE"
                            ? "Equipo de Gerente"
                            : equipo.tipo_equipo === "SUBGERENTE"
                              ? "Equipo de Subgerente"
                              : equipo.tipo_equipo === "JEFE"
                                ? "Equipo de Jefe"
                                : "Equipo GTR"}
                        </span>
                      )}
                      {!equipo.activo && <span className={`${styles.badge} ${styles.badgeInactivo}`}>Inactivo</span>}
                      {puedoGestionar ? (
                        <span className={`${styles.badge} ${styles.badgeGestionar}`}>Puedes gestionar</span>
                      ) : equipo.mi_rol_en_equipo === "SUB_LIDER" ? (
                        <span className={`${styles.badge} ${styles.badgeSubLider}`}>Eres Sub-líder</span>
                      ) : null}
                    </div>
                    <div className={styles.cardMeta}>
                      <span>Líder: <strong>{liderNombre}</strong></span>
                      <span>Miembros: {equipo.miembros.length} (activos {totalActivos}{totalIndisponibles ? `, indisponibles ${totalIndisponibles}` : ""})</span>
                      {!esClientePuro && (

                        <span>Tu rol: <strong>{miRolLabel}</strong></span>

                      )}
                    </div>
                  </div>
                  <div className={styles.cardHeaderRight}>
                    <span>{expandido ? "Ocultar" : "Ver integrantes"}</span>
                    <span className={`${styles.cardHeaderArrow} ${expandido ? styles.cardHeaderArrowOpen : ""}`}>▼</span>
                  </div>
                </div>

                {expandido && (
                  <div className={styles.expand}>
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
                                title={!tieneSubLiderActivo ? "CONDICION: Debe haber un sub-líder asignado en el equipo para que el líder pueda marcarse indisponible" : "Inactivar cuenta"}
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
                                Volver a estado activo
                              </button>
                            ) : null}
                            <span style={{ fontSize: 11, color: "#6b7280" }}>Condición: debe haber sub-líder</span>
                          </div>
                        </>
                      }
                    </div>

                    <div className={styles.expandToolbar}>
                      <h4 className={styles.expandToolbarTitle}>Integrantes — {equipo.miembros.length} miembros</h4>
                      <div className={styles.expandToolbarActions}>
                        {(soyLider || esAdmin) && (
                          <button
                            onClick={() => abrirModalAprobadores(equipo)}
                            disabled={!!accionando}
                            title="Asignar un gerente, un subgerente y un jefe como aprobadores del equipo"
                            style={{ background: "#1d4ed8", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                          >
                            Asignar aprobadores
                          </button>
                        )}
                        {puedoGestionar && (
                          <button
                            onClick={() => abrirModalAgregar(equipo)}
                            disabled={!!accionando || !liderActivo}
                            className={styles.btnAgregar}
                            title={!liderActivo ? "El líder está inactivo" : "Agregar integrante"}
                          >
                            + Agregar integrante
                          </button>
                        )}
                      </div>
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
                                          disabled={!!accionando || !liderActivo || m.estado !== "ACTIVO"}
                                          title={
                                            !liderActivo
                                              ? "No puedes gestionar el equipo porque el líder está inactivo"
                                              : m.estado !== "ACTIVO"
                                                ? "Solo miembros activos pueden ser sub-líder"
                                                : "Otorgar/revocar SUB-LÍDER"
                                          } style={{
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
                                          disabled={!!accionando || !liderActivo}
                                          title="ELIMINAR DEL GRUPO: ya no pertenecerá hasta re-agregarse como MIEMBRO. Si tiene subtareas pendientes, deberás reasignarlas."
                                          style={{ background: "white", color: "#991b1b", border: "1px solid #fecaca", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                                        >
                                          Eliminar del grupo
                                        </button>

                                        {m.estado !== "INDISPONIBLE" ? (
                                          <button
                                            onClick={() => abrirModalIndisponible(equipo.id, m)}
                                            disabled={!!accionando || !liderActivo || m.estado === "INACTIVO"}
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

      {/* Modal agregar integrante */}
      {modalAgregar && (
        <div
          onClick={() => setModalAgregar(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 560, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Agregar integrante</h3>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
              Busca y selecciona un usuario para agregarlo al equipo <strong>{modalAgregar.nombre}</strong>.
              {" "}Solo se listan usuarios con rol <strong>{modalAgregar.rol_integrante_requerido ?? "MIEMBRO"}</strong>.
            </p>

            <input
              value={busquedaUsuario}
              onChange={(e) => setBusquedaUsuario(e.target.value)}
              placeholder="Buscar por nombre, email o código"
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 10 }}
            />

            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid #f3f4f6", borderRadius: 8, padding: 6 }}>
              {usuariosFiltrados.length === 0 ? (
                <div style={{ padding: 12, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
                  No hay usuarios disponibles para agregar.
                </div>
              ) : (
                usuariosFiltrados.map((u) => {
                  const valor = u.codigo ?? String(u.id);
                  const seleccionado = agregarUsuarioId === valor;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setAgregarUsuarioId(valor)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        background: seleccionado ? "#ede9fe" : "white",
                        border: `1px solid ${seleccionado ? "#7c3aed" : "#e5e7eb"}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                    >
                      <span>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {u.nombres} {u.apellidos}
                        </span>
                        <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>
                          {u.email} • {u.codigo ?? "—"}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: seleccionado ? "#5b21b6" : "#9ca3af" }}>
                        {seleccionado ? "Seleccionado" : "Elegir"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "#374151" }}>
              o ingresa el código MFS manualmente
              <input
                value={agregarUsuarioId.toUpperCase().startsWith("MFS-") ? agregarUsuarioId : ""}
                onChange={(e) => setAgregarUsuarioId(e.target.value.toUpperCase())}
                placeholder="Ej. MFS-20250830-12345"
                style={{ width: "100%", marginTop: 4, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "monospace", fontWeight: 400 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalAgregar(null)} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={confirmarAgregar}
                disabled={!agregarUsuarioId || !!accionando}
                style={{ background: agregarUsuarioId ? "#111827" : "#9ca3af", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: agregarUsuarioId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600 }}
              >
                Agregar al equipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear equipo */}
      {modalCrear && (
        <div
          onClick={() => setModalCrear(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 480, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Crear equipo</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
              Designa un líder elegible (GERENTE, SUBGERENTE, JEFE o GTR).
            </p>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Nombre del equipo
              <input
                value={nuevo.nombre}
                onChange={(e) => setNuevo((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del equipo"
                style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 400 }}
              />
            </label>

            {esAdmin && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 12 }}>
                Código del líder
                <input
                  value={nuevo.lider}
                  onChange={(e) => setNuevo((prev) => ({ ...prev, lider: e.target.value.toUpperCase() }))}
                  placeholder="Ej. MFS-20260831-88981"
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "monospace", fontWeight: 400 }}
                />
              </label>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalCrear(false)} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={crearEquipo}
                disabled={!nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim())}
                style={{
                  background: !nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim()) ? "#9ca3af" : "#7c3aed",
                  color: "white",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: !nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim()) ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Crear equipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar aprobadores */}
      {modalAprobadores && (
        <div
          onClick={() => setModalAprobadores(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 520, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Asignar aprobadores</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
              Equipo <strong>{modalAprobadores.nombre}</strong>: asigna exactamente un gerente, un subgerente y un jefe.
              Cualquiera de ellos podrá aprobar las solicitudes del equipo antes de la revisión del líder.
            </p>

            {(["GERENTE", "SUBGERENTE", "JEFE"] as const).map((rol) => (
              <label key={rol} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 12 }}>
                {rol === "GERENTE" ? "Gerente" : rol === "SUBGERENTE" ? "Subgerente" : "Jefe"}
                <select
                  value={aprobadoresSel[rol]}
                  onChange={(e) => setAprobadoresSel((prev) => ({ ...prev, [rol]: e.target.value }))}
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 400 }}
                >
                  <option value="">— seleccionar —</option>
                  {usuariosPorRol(rol).map((u) => (
                    <option key={u.id} value={u.codigo ?? String(u.id)}>
                      {u.nombres} {u.apellidos} ({u.codigo ?? u.email})
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalAprobadores(null)} style={{ background: "white", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={confirmarAprobadores}
                disabled={!!accionando}
                style={{ background: "#1d4ed8", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Guardar aprobadores
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
