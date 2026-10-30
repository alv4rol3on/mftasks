"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo, EquipoMiembroDetallado, RolInfo } from "@/lib/types";
import RefreshButton from "@/components/ui/RefreshButton";
import PageLoader from "@/components/ui/PageLoader";
import styles from "./Equipos.module.css";

type EquipoApiResponse = EquipoInfo[] | { results: EquipoInfo[] };

function extraerEquipos(data: EquipoApiResponse): EquipoInfo[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) return (data as { results: EquipoInfo[] }).results ?? [];
  return [];
}

type Pendiente = { subtarea_id: number; descripcion: string; tarea_id: number; tarea_asunto: string; estado: string };

type TipoUsuario = "COLABORADOR" | "CLIENTE" | "ADMINISTRADOR";

type UsuarioLista = {
  id: number;
  codigo?: string;
  email: string;
  nombres: string;
  apellidos: string;
  roles?: string[];
  tipo_usuario?: TipoUsuario;
  is_active?: boolean;
  activo?: boolean;
};

export default function EquiposPage() {
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipoExpandido, setEquipoExpandido] = useState<number | null>(null);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // modal reasignar por baja de membresía con subtareas pendientes
  const [modalReasignar, setModalReasignar] = useState<{
    equipo: EquipoInfo;
    miembro: EquipoMiembroDetallado;
    pendientes: Pendiente[];
    usuarioNombre: string;
  } | null>(null);
  const [reassignments, setReassignments] = useState<Record<number, number>>({});
  // modal agregar miembro
  const [modalAgregar, setModalAgregar] = useState<EquipoInfo | null>(null);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<{ id: number; codigo?: string; email: string; nombres: string; apellidos: string; is_active?: boolean; activo?: boolean; roles?: string[] }[]>([]);
  const [agregarUsuarioId, setAgregarUsuarioId] = useState<string>("");
  const [busquedaUsuario, setBusquedaUsuario] = useState<string>("");
  // modal crear equipo
  const [modalCrear, setModalCrear] = useState(false);
  // modal de integrante (ajustes: sub-líder, inactivar, eliminar)
  const [modalMiembro, setModalMiembro] = useState<{ equipo: EquipoInfo; miembro: EquipoMiembroDetallado } | null>(null);
  const [usuariosTodos, setUsuariosTodos] = useState<UsuarioLista[]>([]);
  const [rolesCatalogo, setRolesCatalogo] = useState<RolInfo[]>([]);
  // Filtros del buscador de líder (modal crear equipo).
  const [liderBusqueda, setLiderBusqueda] = useState("");
  const [liderTipoFiltro, setLiderTipoFiltro] = useState<string>("todos");
  const [liderRolFiltro, setLiderRolFiltro] = useState<string>("todos");

  const usuario = getUsuarioActual();
  const roles = (usuario?.roles ?? []).map((r) => r.toLowerCase());
  const esAdmin = roles.includes("administrador");
  const esClientePuro = roles.includes("cliente") && !esAdmin && !roles.includes("miembro") && !roles.includes("asignador");
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

  // --------------------------------------------------
  // CATÁLOGOS (usuarios + roles) para el alta de equipos
  // --------------------------------------------------

  const asegurarCatalogos = async () => {
    const pendientes: Promise<unknown>[] = [];

    if (usuariosTodos.length === 0) {
      pendientes.push(
        apiFetch<UsuarioLista[] | { results: UsuarioLista[] }>("/api/usuarios/usuarios/")
          .then((data) => {
            const lista = Array.isArray(data) ? data : data.results ?? [];
            setUsuariosTodos(
              lista.filter((u) => (u.is_active ?? u.activo) !== false)
            );
          })
          .catch(() => setUsuariosTodos([]))
      );
    }

    if (rolesCatalogo.length === 0) {
      pendientes.push(
        apiFetch<RolInfo[] | { results: RolInfo[] }>("/api/usuarios/roles/")
          .then((data) =>
            setRolesCatalogo(Array.isArray(data) ? data : data.results ?? [])
          )
          .catch(() => setRolesCatalogo([]))
      );
    }

    await Promise.all(pendientes);
  };

  // Precargar catálogos al montar para el alta de equipos (líderes elegibles).
  useEffect(() => {
    asegurarCatalogos();
  }, []);

  const mapaRolesNombre = new Map<string, RolInfo>(
    rolesCatalogo.map((r) => [r.nombre.toLowerCase(), r])
  );

  /** True si el usuario puede liderar un equipo (administrador o rol que lidera). */
  const puedeLiderar = (u: UsuarioLista) => {
    if (u.tipo_usuario === "ADMINISTRADOR") return true;
    if (u.tipo_usuario === "CLIENTE") return false;
    return (u.roles ?? []).some(
      (r) => mapaRolesNombre.get(r.toLowerCase())?.puede_liderar === true
    );
  };

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

  const handleCambiarEstado = async (equipo: EquipoInfo, miembro: EquipoMiembroDetallado, estado: "ACTIVO" | "INACTIVO", extra?: { reassignments?: { subtarea_id: number; nuevo_asignado: number }[] }) => {
    const key = `${equipo.id}-estado-${miembro.id_usuario}-${estado}`;
    setAccionando(key);
    setMensaje(null);
    try {
      await apiFetch(`/api/usuarios/equipos/${equipo.id}/miembros/${miembro.id_usuario}/estado/`, {
        method: "POST",
        body: JSON.stringify({
          estado,
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
        });
        setReassignments({});
      }
      setMensaje(`Error: ${msg}`);
      return false;
    } finally {
      setAccionando(null);
    }
  };

  // Baja de membres?a: si tiene subtareas pendientes, abre el reasignador.
  const handleBajaMiembro = async (
    equipo: EquipoInfo,
    miembro: EquipoMiembroDetallado
  ) => {
    const key = `${equipo.id}-estado-${miembro.id_usuario}-INACTIVO`;
    if (!confirm(`?Dar de baja a ${miembro.nombres} ${miembro.apellidos}? Ya no pertenecer? hasta que lo vuelvas a agregar.`)) return;
    setAccionando(key);
    setMensaje(null);
    try {
      await apiFetch(`/api/usuarios/equipos/${equipo.id}/miembros/${miembro.id_usuario}/estado/`, {
        method: "POST",
        body: JSON.stringify({ estado: "INACTIVO" }),
      });
      setMensaje(`${miembro.nombres} ${miembro.apellidos} fue eliminado del equipo.`);
      await recargar();
    } catch (e: any) {
      const raw = (e as Error).message;
      if (raw.includes("pendientes") || raw.includes("reasign")) {
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
            });
            setReassignments({});
            setMensaje(`Error: ${raw} - el usuario tiene subtareas pendientes, estas deben completarse o reasignarse`);
            return;
          }
        } catch { }
      }
      setMensaje(`Error: ${raw}`);
    } finally {
      setAccionando(null);
    }
  };

  const confirmarReasignarYMarcar = async () => {
    if (!modalReasignar) return;
    const { equipo, miembro, pendientes } = modalReasignar;
    const reassignList = pendientes.map((p) => ({
      subtarea_id: p.subtarea_id,
      nuevo_asignado: reassignments[p.subtarea_id],
    }));
    const sinAsignar = reassignList.filter((r) => !r.nuevo_asignado);
    if (sinAsignar.length > 0) {
      setMensaje("Error: debes reasignar todas las subtareas antes de dar de baja.");
      return;
    }
    const ok = await handleCambiarEstado(equipo, miembro, "INACTIVO", {
      reassignments: reassignList,
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

  if (cargando) return <PageLoader label="Cargando equipos…" />;
  if (error) return <div style={{ background: "color-mix(in srgb, var(--color-danger) 10%, white)", color: "var(--color-danger)", padding: 12, borderRadius: 8, fontSize: 14 }}>Error al cargar equipos: {error}</div>;

  // Líderes elegibles (administradores o colaboradores con rol que puede liderar).
  const lideresCandidatos = usuariosTodos.filter(puedeLiderar);
  const rolesLider = rolesCatalogo
    .filter((r) => r.puede_liderar && r.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const lideresFiltrados = lideresCandidatos.filter((u) => {
    if (
      liderTipoFiltro !== "todos" &&
      (u.tipo_usuario ?? "COLABORADOR") !== liderTipoFiltro
    ) {
      return false;
    }
    if (
      liderRolFiltro !== "todos" &&
      !(u.roles ?? []).some(
        (r) => r.toLowerCase() === liderRolFiltro.toLowerCase()
      )
    ) {
      return false;
    }
    const q = liderBusqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      u.nombres.toLowerCase().includes(q) ||
      u.apellidos.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.codigo ?? "").toLowerCase().includes(q)
    );
  });

  const badgeRol = (rol?: string | null) => {
    if (rol === "LIDER") return <span style={{ background: "var(--color-badge)", color: "var(--color-background)", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>LÍDER</span>;
    if (rol === "SUB_LIDER") return <span style={{ background: "var(--color-badge)", color: "var(--color-background)", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>SUB-LÍDER</span>;
    if (rol === "MIEMBRO") return <span style={{ background: "var(--color-border)", color: "var(--color-text)", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>MIEMBRO</span>;
    return null;
  };

  const badgeEstado = (estado: string) => {
    if (estado === "ACTIVO")
      return (
        <span style={{
          background: "var(--color-done)",
          color: "white",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600
        }}>
          Miembro activo
        </span>
      ); if (estado === "INACTIVO") return <span style={{ background: "color-mix(in srgb, var(--color-danger) 10%, white)", color: "var(--color-danger)", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Inactivo</span>;
    return <span style={{ background: "var(--color-border)", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>{estado}</span>;
  };

  const badgeDisponibilidad = (miembro?: EquipoMiembroDetallado | null) => {
    if (miembro?.disponibilidad?.estado === "INDISPONIBLE") {
      return <span style={{ background: "color-mix(in srgb, var(--color-waiting) 12%, white)", color: "var(--color-waiting)", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Indisponible</span>;
    }
    return (
      <span style={{
        background: "var(--color-done)",
        color: "white",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600
      }}>
        Disponible
      </span>
    );
  };

  const esLiderDeEquipo = (equipo: EquipoInfo) => equipo.lider?.id === usuario?.id || esAdmin;

  const liderActivoModal = (() => {
    if (!modalMiembro) return false;
    const lider = modalMiembro.equipo.miembros.find((m) => m.id_usuario === modalMiembro.equipo.lider?.id);
    return lider?.estado === "ACTIVO";
  })();

  const abrirModalCrear = async () => {
    setNuevo({ nombre: "", lider: "" });
    setLiderBusqueda("");
    setLiderTipoFiltro("todos");
    setLiderRolFiltro("todos");
    setMensaje(null);
    setModalCrear(true);
    await asegurarCatalogos();
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
      setMensaje("Selecciona el líder del equipo.");
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
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {puedeCrearEquipo && !esClientePuro && (
            <button
              onClick={abrirModalCrear}
              style={{ background: "var(--color-brand)", color: "white", border: "1px solid var(--color-brand)", padding: "8px 14px", borderRadius: "var(--radius-control)", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              + Crear equipo
            </button>
          )}
          <RefreshButton onClick={recargar} loading={cargando} variant="solid" />
        </div>
      </div>

      {!esClientePuro && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSoloMios((v) => !v)}
            style={{
              border: "1px solid var(--color-border)",
              background: soloMios ? "var(--color-solomios)" : "var(--color-background)",
              color: soloMios ? "var(--color-background-2)" : "var(---color-solomios)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {soloMios ? "Filtro: solo mis equipos" : "Filtro: todos los equipos"}
          </button>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
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
        <div style={{ background: "color-mix(in srgb, var(--color-in-progress) 10%, white)", border: "1px solid color-mix(in srgb, var(--color-in-progress) 28%, white)", padding: 12, borderRadius: 8, fontSize: 13, color: "var(--color-in-progress)" }}>
          Para crear una solicitud, elige uno de estos equipos en <Link href="/mfpages/cliente/mis-solicitudes" style={{ textDecoration: "underline", color: "#1d4ed8" }}>Mis Solicitudes</Link>.
        </div>
      )}

      {equiposVisibles.length === 0 ? (
        <div style={{ background: "white", border: "1px solid var(--color-border)", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>
            {soloMios
              ? "No perteneces a ningún equipo aún."
              : filtroTipo !== "TODOS"
                ? "No hay equipos de ese tipo."
                : esClientePuro
                  ? "No hay equipos activos disponibles por el momento."
                  : "No hay equipos disponibles."}
          </p>
          {!esClientePuro && !soloMios && <p style={{ color: "var(--color-text-secondary)", fontSize: 12, margin: "8px 0 0" }}>Contacta a tu administrador para ser asignado a un equipo.</p>}
        </div>
      ) : (
        <div className={styles.grid}>
          {equiposVisibles.map((equipo) => {
            const expandido = equipoExpandido === equipo.id;
            const soyLider = equipo.lider?.id === usuario?.id || (esAdmin && equipo.puedo_gestionar);
            const miRolLabel = equipo.mi_rol_en_equipo === "LIDER" ? "Líder" : equipo.mi_rol_en_equipo === "SUB_LIDER" ? "Sub-líder" : equipo.mi_rol_en_equipo === "MIEMBRO" ? "Miembro" : esClientePuro ? "" : "—";
            const liderNombre = equipo.lider ? `${equipo.lider.nombres} ${equipo.lider.apellidos}` : "—";
            const totalActivos = equipo.miembros.filter((m) => m.estado === "ACTIVO").length;
            const totalIndisponibles = equipo.miembros.filter((m) => m.disponibilidad?.estado === "INDISPONIBLE").length;
            const liderMiembro = equipo.miembros.find((m) => m.id_usuario === equipo.lider?.id);
            const liderActivo = liderMiembro?.estado === "ACTIVO";
            const puedoGestionar = Boolean(equipo.puedo_gestionar) && liderActivo;

            return (
              <div key={equipo.id} className={styles.card}>
                <div
                  onClick={() => setEquipoExpandido(expandido ? null : equipo.id)}
                  className={styles.cardHeader}
                  style={equipo.rol_color ? ({ "--rol-color": equipo.rol_color } as React.CSSProperties) : undefined}
                >
                  <div className={styles.cardHeaderLeft}>
                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle}>{equipo.nombre}</h3>
                      {puedoGestionar ? (
                        <span className={`${styles.badge} ${styles.badgeGestionar}`}>
                          Puedes gestionar
                        </span>
                      ) : equipo.mi_rol_en_equipo === "SUB_LIDER" ? (
                        <span className={`${styles.badge} ${styles.badgeSubLider}`}>
                          Eres Sub-líder
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.cardMeta}>
                      <span>Líder: <strong>{liderNombre}</strong></span>
                      <span>Miembros: {equipo.miembros.length} (activos {totalActivos}{totalIndisponibles ? `, indisponibles ${totalIndisponibles}` : ""})</span>
                      {!esClientePuro && miRolLabel !== "—" && (

                        <span>Tu rol: <strong>{miRolLabel}</strong></span>

                      )}
                    </div>
                  </div>
                  <div className={styles.cardHeaderRight}>
                    <span className={`${styles.cardHeaderArrow} ${expandido ? styles.cardHeaderArrowOpen : ""}`}>▼</span>
                  </div>
                </div>

                {expandido && (
                  <div className={styles.expand}>
                    {/* Fila l?der */}
                    <div className={styles.expandToolbar}>
                      <h4 className={styles.expandToolbarTitle}>Integrantes — {equipo.miembros.length} miembros</h4>
                      <div className={styles.expandToolbarActions}>
                        {soyLider && (
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

                    <div style={{ marginBottom: 12, background: "var(--color-background)", border: `1px solid ${liderMiembro?.disponibilidad?.estado === "INDISPONIBLE" ? "var(--color-waiting)" : "var(--color-border)"}`, borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {liderNombre} {badgeRol("LIDER")} {liderMiembro && badgeEstado(liderMiembro.estado)} {liderMiembro && badgeDisponibilidad(liderMiembro)}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-background-2)" }}>{equipo.lider?.email ?? ""} {equipo.lider?.cargo ? `▸ ${equipo.lider.cargo}` : ""}</div>
                        {liderMiembro?.disponibilidad?.estado === "INDISPONIBLE" && (
                          <div style={{ fontSize: 11, color: "var(--color-waiting)", marginTop: 4 }}>
                            {liderMiembro.disponibilidad.motivo ? `Motivo: ${liderMiembro.disponibilidad.motivo}` : ""}
                            {liderMiembro.disponibilidad.fecha_inicio ? ` ? ${liderMiembro.disponibilidad.fecha_inicio}` : ""}
                            {liderMiembro.disponibilidad.fecha_fin ? ` ? ${liderMiembro.disponibilidad.fecha_fin}` : ""}
                          </div>
                        )}
                      </div>
                    </div>


                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--color-background)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-border)" }}>
                        <thead>
                          <tr style={{ background: "var(--color-surface)", textAlign: "left", fontSize: 12, color: "var(--color-text-secondary)" }}>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Miembro</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Email</th>
                            <th style={{ padding: "10px 12px", fontWeight: 600 }}>Rol en equipo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipo.miembros.filter((m) => m.rol_en_equipo !== "LIDER").length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ padding: 16, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
                                Sin integrantes adicionales (solo líder)
                              </td>
                            </tr>
                          ) : (
                            equipo.miembros.filter((m) => m.rol_en_equipo !== "LIDER").map((m) => {
                              const esYo = m.id_usuario === usuario?.id;
                              return (
                                <tr
                                  key={m.id}
                                  onClick={() => { if (puedoGestionar) setModalMiembro({ equipo, miembro: m }); }}
                                  title={puedoGestionar ? "Clic para gestionar al integrante" : undefined}
                                  style={{
                                    borderTop: "1px solid var(--color-border)",
                                    fontSize: 13,
                                    background: "var(--color-background)",
                                    opacity: m.estado === "INACTIVO" ? 0.7 : 1,
                                    cursor: puedoGestionar ? "pointer" : "default"
                                  }}                                >
                                  <td style={{ padding: "10px 12px" }}>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontWeight: 600,
                                        color: "var(--color-text)",
                                      }}
                                    >
                                      <span
                                        className={
                                          m.disponibilidad?.estado === "INDISPONIBLE"
                                            ? styles.disponibilidadNoDisponible
                                            : styles.disponibilidadDisponible
                                        }
                                        title={
                                          m.disponibilidad?.estado === "INDISPONIBLE"
                                            ? "No disponible"
                                            : "Disponible"
                                        }
                                        aria-label={
                                          m.disponibilidad?.estado === "INDISPONIBLE"
                                            ? "No disponible"
                                            : "Disponible"
                                        }
                                      />

                                      <span>
                                        {m.nombres} {m.apellidos}
                                        {esYo && (
                                          <span
                                            style={{
                                              background: "color-mix(in srgb, var(--color-in-progress) 12%, white)",
                                              color: "var(--color-in-progress)",
                                              padding: "1px 6px",
                                              borderRadius: 999,
                                              fontSize: 11,
                                              marginLeft: 6,
                                            }}
                                          >
                                            Tú
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{m.cargo || "—"}</div>
                                    {m.disponibilidad?.estado === "INDISPONIBLE" && (
                                      <div style={{ fontSize: 11, color: "var(--color-waiting)", marginTop: 4 }}>
                                        {m.disponibilidad.motivo ? `Motivo: ${m.disponibilidad.motivo}` : ""}
                                        {m.disponibilidad.fecha_inicio ? ` · ${m.disponibilidad.fecha_inicio}` : ""}
                                        {m.disponibilidad.fecha_fin ? ` → ${m.disponibilidad.fecha_fin}` : ""}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "10px 12px", color: "var(--color-text)", fontSize: 12 }}>{m.email}</td>
                                  <td style={{ padding: "10px 12px" }}>{badgeRol(m.rol_en_equipo)}</td>
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

      {/* Modal de integrante */}
      {modalMiembro && (
        <div
          onClick={() => setModalMiembro(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 480, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>
                  {modalMiembro.miembro.nombres} {modalMiembro.miembro.apellidos}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {modalMiembro.miembro.email} · {modalMiembro.miembro.cargo || "—"}
                </p>
              </div>
              <button onClick={() => setModalMiembro(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {badgeRol(modalMiembro.miembro.rol_en_equipo)}
              {badgeEstado(modalMiembro.miembro.estado)}
              {badgeDisponibilidad(modalMiembro.miembro)}
            </div>

            {modalMiembro.miembro.disponibilidad?.estado === "INDISPONIBLE" && (
              <div style={{ fontSize: 12, color: "var(--color-waiting)", marginTop: 10, background: "color-mix(in srgb, var(--color-waiting) 10%, white)", border: "1px solid color-mix(in srgb, var(--color-waiting) 30%, white)", borderRadius: 8, padding: 8 }}>
                {modalMiembro.miembro.disponibilidad.motivo ? `Motivo: ${modalMiembro.miembro.disponibilidad.motivo}` : ""}
                {modalMiembro.miembro.disponibilidad.fecha_inicio ? ` · ${modalMiembro.miembro.disponibilidad.fecha_inicio}` : ""}
                {modalMiembro.miembro.disponibilidad.fecha_fin ? ` → ${modalMiembro.miembro.disponibilidad.fecha_fin}` : ""}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => {
                  const { equipo, miembro } = modalMiembro;
                  setModalMiembro(null);
                  handleToggleSubLider(equipo, miembro);
                }}
                disabled={!!accionando || !liderActivoModal || modalMiembro.miembro.estado !== "ACTIVO"}
                title={
                  !liderActivoModal
                    ? "No puedes gestionar el equipo porque el líder está inactivo"
                    : modalMiembro.miembro.estado !== "ACTIVO"
                      ? "Solo miembros activos pueden ser sub-líder"
                      : "Otorgar/revocar SUB-LÍDER"
                }
                style={{
                  background: modalMiembro.miembro.rol_en_equipo === "SUB_LIDER" ? "color-mix(in srgb, var(--color-waiting) 12%, white)" : "white",
                  color: modalMiembro.miembro.rol_en_equipo === "SUB_LIDER" ? "var(--color-waiting)" : "var(--color-text)",
                  border: `1px solid ${modalMiembro.miembro.rol_en_equipo === "SUB_LIDER" ? "var(--color-waiting)" : "var(--color-border)"}`,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: modalMiembro.miembro.estado !== "ACTIVO" ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: modalMiembro.miembro.estado !== "ACTIVO" ? 0.5 : 1,
                }}
              >
                {modalMiembro.miembro.rol_en_equipo === "SUB_LIDER" ? "Revocar sub-líder" : "Hacer sub-líder"}
              </button>

              <button
                onClick={() => {
                  const { equipo, miembro } = modalMiembro;
                  setModalMiembro(null);
                  handleBajaMiembro(equipo, miembro);
                }}
                disabled={!!accionando || !liderActivoModal}
                title="ELIMINAR DEL GRUPO: ya no pertenecerá hasta re-agregarse como MIEMBRO. Si tiene subtareas pendientes, deberás reasignarlas."
                style={{ background: "white", color: "var(--color-danger)", border: "1px solid color-mix(in srgb, var(--color-danger) 28%, white)", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Eliminar del grupo
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModalMiembro(null)} style={{ background: "white", border: "1px solid var(--color-border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cerrar</button>
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
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-danger)" }}>Subtareas pendientes — reasignación requerida</h3>
            <p style={{ margin: "6px 0 12px", fontSize: 13, color: "var(--color-text)", background: "color-mix(in srgb, var(--color-danger) 10%, white)", padding: 10, borderRadius: 8 }}>
              el siguiente usuario tiene subtareas pendientes, estas deben completarse o re-asignarse: <strong>{modalReasignar.usuarioNombre}</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {modalReasignar.pendientes.map((p) => {
                const opciones = modalReasignar.equipo.miembros.filter((m) => m.estado === "ACTIVO" && m.id_usuario !== modalReasignar.miembro.id_usuario);
                return (
                  <div key={p.subtarea_id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, background: "var(--color-surface)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{p.descripcion}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Tarea #{p.tarea_id} — {p.tarea_asunto} • Estado: {p.estado}</div>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600 }}>
                      Reasignar a:
                      <select
                        value={reassignments[p.subtarea_id] ?? ""}
                        onChange={(e) => setReassignments((prev) => ({ ...prev, [p.subtarea_id]: Number(e.target.value) }))}
                        style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
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
              <button onClick={() => setModalReasignar(null)} style={{ background: "white", border: "1px solid var(--color-border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cerrar</button>
              <button onClick={confirmarReasignarYMarcar} style={{ background: "var(--color-brand)", color: "var(--color-background)", border: "1px solid var(--color-brand)", padding: "8px 14px", borderRadius: "var(--radius-control)", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                Reasignar y dar de baja
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>Puedes reasignar todas a una misma persona seleccionando el mismo destino. Las subtareas deben reasignarse a miembros con estado ACTIVO.</div>
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
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Agregar integrante</h3>
            <input
              value={busquedaUsuario}
              onChange={(e) => setBusquedaUsuario(e.target.value)}
              placeholder="Buscar por nombre, email o código"
              style={{ width: "100%", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 10 }}
            />

            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--color-surface)", borderRadius: 8, padding: 6 }}>
              {usuariosFiltrados.length === 0 ? (
                <div style={{ padding: 12, fontSize: 13, color: "var(--color-text-secondary)", textAlign: "center" }}>
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
                        background: seleccionado ? "color-mix(in srgb, var(--color-detail-header) 10%, white)" : "white",
                        border: `1px solid ${seleccionado ? "var(--color-detail-header)" : "var(--color-border)"}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                    >
                      <span>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                          {u.nombres} {u.apellidos}
                        </span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)" }}>
                          {u.email} • {u.codigo ?? "—"}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: seleccionado ? "var(--color-detail-header)" : "var(--color-text-secondary)" }}>
                        {seleccionado ? "Seleccionado" : "Elegir"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
              o ingresa el código MFS manualmente
              <input
                value={agregarUsuarioId.toUpperCase().startsWith("MFS-") ? agregarUsuarioId : ""}
                onChange={(e) => setAgregarUsuarioId(e.target.value.toUpperCase())}
                placeholder="Ej. MFS-20250830-12345"
                style={{ width: "100%", marginTop: 4, border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "monospace", fontWeight: 400 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalAgregar(null)} style={{ background: "white", border: "1px solid var(--color-border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={confirmarAgregar}
                disabled={!agregarUsuarioId || !!accionando}
                style={{ background: agregarUsuarioId ? "var(--color-text)" : "var(--color-text-secondary)", color: "white", border: "none", padding: "8px 14px", borderRadius: 8, cursor: agregarUsuarioId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600 }}
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
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Crear equipo</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-secondary)" }}>
              Selecciona un líder elegible (colaborador con rol que puede liderar, o administrador).
            </p>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
              Nombre del equipo
              <input
                value={nuevo.nombre}
                onChange={(e) => setNuevo((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del equipo"
                style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 400 }}
              />
            </label>

            {esAdmin && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Líder del equipo</span>

                <input
                  value={liderBusqueda}
                  onChange={(e) => setLiderBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, email o código"
                  style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                />

                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={liderTipoFiltro}
                    onChange={(e) => setLiderTipoFiltro(e.target.value)}
                    style={{ flex: 1, border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                  >
                    <option value="todos">Todos los tipos</option>
                    <option value="COLABORADOR">Colaborador</option>
                    <option value="ADMINISTRADOR">Administrador</option>
                  </select>

                  <select
                    value={liderRolFiltro}
                    onChange={(e) => setLiderRolFiltro(e.target.value)}
                    style={{ flex: 1, border: "1px solid var(--color-border)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                  >
                    <option value="todos">Todos los roles</option>
                    {rolesLider.map((r) => (
                      <option key={r.id} value={r.nombre}>{r.nombre}</option>
                    ))}
                  </select>
                </div>

                <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--color-surface)", borderRadius: 8, padding: 6 }}>
                  {lideresFiltrados.length === 0 ? (
                    <div style={{ padding: 10, fontSize: 12, color: "var(--color-text-secondary)", textAlign: "center" }}>
                      No hay usuarios elegibles que coincidan.
                    </div>
                  ) : (
                    lideresFiltrados.map((u) => {
                      const valor = u.codigo ?? String(u.id);
                      const sel = nuevo.lider === valor;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setNuevo((prev) => ({ ...prev, lider: valor }))}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            background: sel ? "color-mix(in srgb, var(--color-detail-header) 10%, white)" : "white",
                            border: `1px solid ${sel ? "var(--color-detail-header)" : "var(--color-border)"}`,
                            borderRadius: 8,
                            padding: "8px 10px",
                            cursor: "pointer",
                          }}
                        >
                          <span>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                              {u.nombres} {u.apellidos}
                            </span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)" }}>
                              {u.email} • {(u.roles ?? []).join(", ") || "—"}
                            </span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: sel ? "var(--color-detail-header)" : "var(--color-text-secondary)" }}>
                            {sel ? "Seleccionado" : "Elegir"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {nuevo.lider && (
                  <span style={{ fontSize: 12, color: "var(--color-text)" }}>
                    Líder seleccionado:{" "}
                    <strong>
                      {(() => {
                        const u = lideresCandidatos.find(
                          (x) => (x.codigo ?? String(x.id)) === nuevo.lider
                        );
                        return u ? `${u.nombres} ${u.apellidos}` : nuevo.lider;
                      })()}
                    </strong>
                  </span>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModalCrear(false)} style={{ background: "white", border: "1px solid var(--color-border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button
                onClick={crearEquipo}
                disabled={!nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim())}
                style={{
                  background: !nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim()) ? "var(--color-disabled)" : "var(--color-brand)",
                  color: !nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim()) ? "var(--color-text-secondary)" : "var(--color-background)",
                  border: "1px solid var(--color-brand)",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-control)",
                  cursor: !nuevo.nombre.trim() || (esAdmin && !nuevo.lider.trim()) ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Crear equipo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
