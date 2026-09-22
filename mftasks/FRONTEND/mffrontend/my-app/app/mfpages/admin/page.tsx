"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import Pagination from "@/components/ui/Pagination";
import SearchableSelect, { SearchableOption } from "@/components/ui/SearchableSelect";
import Switch from "@/components/ui/Switch";
import { existeNombreNormalizado, nombresSimilares } from "@/lib/similitud";
import styles from "./Admin.module.css";

type Usuario = { id: number; codigo?: string; email: string; nombres: string; apellidos: string; cargo?: string; is_active: boolean; roles?: string[] };
type CampanaPerm = { id: number; nombre: string; codigo: string; subcampanas: { id: number; nombre: string; codigo: string; activo: boolean; campana: number }[]; activo: boolean };
type Permiso = { id: number; usuario: number; usuario_email: string; subcampana: number | null; subcampana_nombre: string | null; campana: number | null; campana_nombre: string | null };

const PAGE_SIZE_USUARIOS = 10;
const PAGE_SIZE_CAMPANAS = 6;

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"usuarios" | "permisos" | "campanas">("usuarios");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [pageUsuarios, setPageUsuarios] = useState(1);
  const [nuevo, setNuevo] = useState({ email: "", nombres: "", apellidos: "", cargo: "", password: "", rol: "miembro" });
  const [selectedClienteId, setSelectedClienteId] = useState<number | "">("");
  const [filtroClientePerm, setFiltroClientePerm] = useState("");
  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [buscandoPermisos, setBuscandoPermisos] = useState(false);
  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroActivoCampana, setFiltroActivoCampana] = useState<"activos" | "inactivos" | "todos">("activos");
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());
  // paginación campañas (compartida pero con reset por tab)
  const [pageCampanas, setPageCampanas] = useState(1);
  const [pagePermisosCampanas, setPagePermisosCampanas] = useState(1);
  // formulario campaña / subcampaña
  const [tipoCreacion, setTipoCreacion] = useState<"campana" | "subcampana">("campana");
  const [nuevaCampanaNombre, setNuevaCampanaNombre] = useState("");
  const [nuevaSubcampana, setNuevaSubcampana] = useState({ campanaId: "", nombre: "" });
  const [creandoCampana, setCreandoCampana] = useState(false);

  const user = getUsuarioActual();
  const isAdmin = (user?.roles ?? []).map(r => r.toLowerCase()).includes("administrador");
  useEffect(() => { if (!isAdmin) router.replace("/mfpages/perfil"); }, [isAdmin, router]);

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const data = await apiFetch<Usuario[] | { results: Usuario[] }>("/api/usuarios/usuarios/");
      const arr = Array.isArray(data) ? data : (data as any).results ?? [];
      setUsuarios(arr);
    } catch (e) { setMsg((e as Error).message); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargarUsuarios(); }, []);

  const crearUsuario = async () => {
    if (!nuevo.email || !nuevo.nombres || !nuevo.apellidos) { setMsg("Email, nombres y apellidos obligatorios"); return; }
    try {
      await apiFetch("/api/usuarios/usuarios/", { method: "POST", body: JSON.stringify({ email: nuevo.email, nombres: nuevo.nombres, apellidos: nuevo.apellidos, cargo: nuevo.cargo, password: nuevo.password || undefined, roles: [nuevo.rol] }) });
      setMsg(`Usuario ${nuevo.email} creado con rol ${nuevo.rol} y codigo auto-generado`);
      setNuevo({ email: "", nombres: "", apellidos: "", cargo: "", password: "", rol: "miembro" });
      await cargarUsuarios();
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
  };

  const toggleActivo = async (u: Usuario) => {
    if ((u.roles ?? []).map(r => r.toLowerCase()).includes("administrador")) {
      setMsg("Error: No se puede modificar usuarios administradores");
      return;
    }
    if (!confirm(`¿${u.is_active ? "Desactivar" : "Activar"} a ${u.nombres} ${u.apellidos} (${u.email})?`)) return;
    try {
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, { method: "PATCH", body: JSON.stringify({ is_active: !u.is_active }) });
      setMsg(`${u.email} ${!u.is_active ? "activado" : "desactivado"}`);
      await cargarUsuarios();
    } catch (e) { setMsg((e as Error).message); }
  };

  const cambiarRol = async (u: Usuario, nuevoRol: string) => {
    if ((u.roles ?? []).map(r => r.toLowerCase()).includes("administrador")) {
      setMsg("Error: No se puede modificar rol de administradores");
      return;
    }
    if (!["miembro", "lider", "cliente"].includes(nuevoRol.toLowerCase())) {
      setMsg("Rol no permitido");
      return;
    }
    try {
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, { method: "PATCH", body: JSON.stringify({ roles: [nuevoRol] }) });
      setMsg(`Rol de ${u.email} cambiado a ${nuevoRol}`);
      await cargarUsuarios();
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const q = filtro.toLowerCase().trim();
    const matchTexto = !q || u.email.toLowerCase().includes(q) || `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) || (u.codigo ?? "").toLowerCase().includes(q);
    if (!matchTexto) return false;
    if (filtroTipo === "todos") return true;
    const rolesLow = (u.roles ?? []).map(r => r.toLowerCase());
    return rolesLow.includes(filtroTipo.toLowerCase());
  });

  // paginación usuarios client-side
  const totalPagesUsuarios = Math.max(1, Math.ceil(usuariosFiltrados.length / PAGE_SIZE_USUARIOS));
  const usuariosPaginados = usuariosFiltrados.slice((pageUsuarios - 1) * PAGE_SIZE_USUARIOS, pageUsuarios * PAGE_SIZE_USUARIOS);
  useEffect(() => { setPageUsuarios(1); }, [filtro, filtroTipo]);
  useEffect(() => { if (pageUsuarios > totalPagesUsuarios) setPageUsuarios(1); }, [totalPagesUsuarios, pageUsuarios]);

  const clientes = usuarios.filter(u => (u.roles ?? []).map(r => r.toLowerCase()).includes("cliente"));
  const clientesFiltrados = clientes.filter(u => {
    if (!filtroClientePerm) return true;
    const q = filtroClientePerm.toLowerCase();
    return u.email.toLowerCase().includes(q) || `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) || (u.codigo ?? "").toLowerCase().includes(q);
  });

  const cargarCampanas = async () => {
    try {
      const data = await apiFetch<CampanaPerm[] | { results: CampanaPerm[] }>("/api/campanas/campanas/");
      const arr = Array.isArray(data) ? data : (data as any).results ?? [];
      setCampanas(arr);
    } catch { setCampanas([]); }
  };
  const cargarPermisos = async (usuarioId: number) => {
    setBuscandoPermisos(true);
    try {
      const data = await apiFetch<Permiso[] | { results: Permiso[] }>(`/api/campanas/permisos/?usuario=${usuarioId}`);
      const arr = Array.isArray(data) ? data : (data as any).results ?? [];
      setPermisos(arr);
    } catch (e) { setMsg(`Error cargando permisos: ${(e as Error).message}`); setPermisos([]); }
    finally { setBuscandoPermisos(false); }
  };
  useEffect(() => { if (tab === "permisos" || tab === "campanas") { cargarCampanas(); } }, [tab]);
  useEffect(() => { if (selectedClienteId !== "") cargarPermisos(Number(selectedClienteId)); else setPermisos([]); }, [selectedClienteId]);

  // Acordeón: colapsadas por defecto con animación simple
  const toggleCampana = (id: number) => setExpandidas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandirTodas = () => setExpandidas(new Set(campanasPaginadas.map(c => c.id)));
  const expandirTodasPermisos = () => setExpandidas(new Set(campanasPaginadasPermisos.map(c => c.id)));
  const colapsarTodas = () => setExpandidas(new Set());

  // Auto-expandir cuando se busca campaña/subcampaña
  useEffect(() => {
    if (filtroCampana.trim()) {
      // expandir solo página visible para no romper paginación
      setExpandidas(new Set(campanasFiltradas.slice(0, PAGE_SIZE_CAMPANAS).map(c => c.id)));
    }
  }, [filtroCampana]);

  // Colapsar al cambiar de cliente (evita mostrar todo apretado)
  useEffect(() => { setExpandidas(new Set()); }, [selectedClienteId]);
  useEffect(() => { setExpandidas(new Set()); setPageCampanas(1); setPagePermisosCampanas(1); }, [filtroActivoCampana]);
  useEffect(() => { setPageCampanas(1); setPagePermisosCampanas(1); setExpandidas(new Set()); }, [tab]);

  const togglePermiso = async (subcampanaId: number, checked: boolean) => {
    if (selectedClienteId === "") { setMsg("Error: selecciona un cliente primero"); return; }
    const clienteId = Number(selectedClienteId);
    setCargandoPermisos(true);
    try {
      if (checked) {
        await apiFetch("/api/campanas/permisos/", { method: "POST", body: JSON.stringify({ usuario: clienteId, subcampana: subcampanaId }) });
        setMsg(`Permiso otorgado para subcampaña ${subcampanaId}`);
      } else {
        const perm = permisos.find(p => p.subcampana === subcampanaId);
        if (!perm) { setMsg("Error: permiso no encontrado"); return; }
        await apiFetch(`/api/campanas/permisos/${perm.id}/`, { method: "DELETE" });
        setMsg(`Permiso revocado para subcampaña ${subcampanaId}`);
      }
      await cargarPermisos(clienteId);
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setCargandoPermisos(false); }
  };

  const toggleActivoCampana = async (campana: CampanaPerm) => {
    if (!confirm(`${campana.activo ? "Inhabilitar" : "Habilitar"} campaña ${campana.nombre} (${campana.codigo})? ${campana.activo ? "Ningún usuario podrá crear tareas con sus subcampañas." : ""}`)) return;
    setTogglingId(campana.id);
    try {
      await apiFetch(`/api/campanas/campanas/${campana.id}/`, { method: "PATCH", body: JSON.stringify({ activo: !campana.activo }) });
      setMsg(`Campaña ${campana.codigo} ${!campana.activo ? "habilitada" : "inhabilitada"}`);
      await cargarCampanas();
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setTogglingId(null); }
  };
  const toggleActivoSubcampana = async (sub: { id: number; nombre: string; codigo: string; activo: boolean; campana: number }, campActiva: boolean) => {
    if (!campActiva && !sub.activo) { setMsg("Error: la campaña está inhabilitada; habilítala primero"); return; }
    if (!confirm(`${sub.activo ? "Inhabilitar" : "Habilitar"} subcampaña ${sub.nombre} (${sub.codigo})? ${sub.activo ? "Ningún usuario podrá crear tareas con ella." : ""}`)) return;
    setTogglingId(sub.id);
    try {
      await apiFetch(`/api/campanas/subcampanas/${sub.id}/`, { method: "PATCH", body: JSON.stringify({ activo: !sub.activo }) });
      setMsg(`Subcampaña ${sub.codigo} ${!sub.activo ? "habilitada" : "inhabilitada"}`);
      await cargarCampanas();
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setTogglingId(null); }
  };

  const subcampanasPadre = useMemo(() => {
    if (!nuevaSubcampana.campanaId) return [];
    const padre = campanas.find((c) => String(c.id) === nuevaSubcampana.campanaId);
    return padre?.subcampanas ?? [];
  }, [campanas, nuevaSubcampana.campanaId]);

  const sugerenciasCampana = useMemo(
    () => nombresSimilares(nuevaCampanaNombre, campanas),
    [nuevaCampanaNombre, campanas]
  );
  const campanaDuplicada = useMemo(
    () => Boolean(existeNombreNormalizado(nuevaCampanaNombre, campanas)),
    [nuevaCampanaNombre, campanas]
  );

  const sugerenciasSubcampana = useMemo(
    () => nombresSimilares(nuevaSubcampana.nombre, subcampanasPadre),
    [nuevaSubcampana.nombre, subcampanasPadre]
  );
  const subcampanaDuplicada = useMemo(
    () => Boolean(existeNombreNormalizado(nuevaSubcampana.nombre, subcampanasPadre)),
    [nuevaSubcampana.nombre, subcampanasPadre]
  );

  const opcionesCampana: SearchableOption[] = useMemo(
    () =>
      campanas.map((c) => ({
        value: String(c.id),
        label: `${c.nombre} (${c.codigo})`,
        sublabel: c.activo ? undefined : "inactiva",
      })),
    [campanas]
  );

  const crearCampana = async () => {
    if (!nuevaCampanaNombre.trim()) { setMsg("Error: el nombre de la campaña es obligatorio"); return; }
    if (campanaDuplicada) { setMsg("Error: ya existe una campaña con un nombre igual o similar"); return; }
    setCreandoCampana(true);
    try {
      await apiFetch("/api/campanas/campanas/", { method: "POST", body: JSON.stringify({ nombre: nuevaCampanaNombre.trim() }) });
      setMsg(`Campaña "${nuevaCampanaNombre.trim()}" creada`);
      setNuevaCampanaNombre("");
      await cargarCampanas();
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setCreandoCampana(false); }
  };
  const crearSubcampana = async () => {
    if (!nuevaSubcampana.campanaId) { setMsg("Error: selecciona una campaña padre"); return; }
    if (!nuevaSubcampana.nombre.trim()) { setMsg("Error: el nombre de la subcampaña es obligatorio"); return; }
    if (subcampanaDuplicada) { setMsg("Error: ya existe una subcampaña con ese nombre en la campaña seleccionada"); return; }
    setCreandoCampana(true);
    try {
      await apiFetch("/api/campanas/subcampanas/", { method: "POST", body: JSON.stringify({ campana: Number(nuevaSubcampana.campanaId), nombre: nuevaSubcampana.nombre.trim() }) });
      setMsg(`Subcampaña "${nuevaSubcampana.nombre.trim()}" creada`);
      setNuevaSubcampana({ campanaId: "", nombre: "" });
      await cargarCampanas();
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setCreandoCampana(false); }
  };

  const permisosSubcampanaIds = new Set(permisos.filter(p => p.subcampana != null).map(p => p.subcampana as number));
  const campanasFiltradas = campanas.filter(c => {
    // filtro activo/inactivo
    if (filtroActivoCampana === "activos" && !c.activo) return false;
    if (filtroActivoCampana === "inactivos" && c.activo) return false;
    if (!filtroCampana) return true;
    const q = filtroCampana.toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.subcampanas.some(s => s.nombre.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q));
  });

  // paginación campañas - separada por tab para no cruzar estado
  const totalPagesCampanas = Math.max(1, Math.ceil(campanasFiltradas.length / PAGE_SIZE_CAMPANAS));
  const campanasPaginadas = campanasFiltradas.slice((pageCampanas - 1) * PAGE_SIZE_CAMPANAS, pageCampanas * PAGE_SIZE_CAMPANAS);
  const totalPagesPermisos = Math.max(1, Math.ceil(campanasFiltradas.length / PAGE_SIZE_CAMPANAS));
  const campanasPaginadasPermisos = campanasFiltradas.slice((pagePermisosCampanas - 1) * PAGE_SIZE_CAMPANAS, pagePermisosCampanas * PAGE_SIZE_CAMPANAS);
  useEffect(() => { setPageCampanas(1); }, [filtroCampana, filtroActivoCampana]);
  useEffect(() => { setPagePermisosCampanas(1); }, [filtroCampana, filtroActivoCampana, selectedClienteId]);
  useEffect(() => { if (pageCampanas > totalPagesCampanas) setPageCampanas(1); }, [totalPagesCampanas, pageCampanas]);
  useEffect(() => { if (pagePermisosCampanas > totalPagesPermisos) setPagePermisosCampanas(1); }, [totalPagesPermisos, pagePermisosCampanas]);

  if (!isAdmin) return <div style={{ padding: 16 }}>Acceso denegado - solo administrador</div>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Administración de usuarios/campañas</h2>
      <div className={styles.tabs}>
        {(["usuarios", "permisos", "campanas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? styles.tabBtnActive : styles.tabBtn}>{t === "campanas" ? "campañas / subcampañas" : t}</button>
        ))}
      </div>
      {msg && <div className={`${styles.msg} ${msg.startsWith("Error") ? styles.msgError : styles.msgSuccess}`}>{msg}</div>}

      {tab === "usuarios" && (
        <div className={styles.container}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Crear nuevo usuario</h3>
            <div className={styles.formGrid}>
              <input placeholder="Email" value={nuevo.email} onChange={e => setNuevo({ ...nuevo, email: e.target.value })} className={styles.input} />
              <input placeholder="Cargo" value={nuevo.cargo} onChange={e => setNuevo({ ...nuevo, cargo: e.target.value })} className={styles.input} />
              <input placeholder="Nombres" value={nuevo.nombres} onChange={e => setNuevo({ ...nuevo, nombres: e.target.value })} className={styles.input} />
              <input placeholder="Apellidos" value={nuevo.apellidos} onChange={e => setNuevo({ ...nuevo, apellidos: e.target.value })} className={styles.input} />
              <input placeholder="Password" type="password" value={nuevo.password} onChange={e => setNuevo({ ...nuevo, password: e.target.value })} className={styles.input} />
              <select value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })} className={styles.select}>
                <option value="miembro">miembro</option>
                <option value="lider">lider</option>
                <option value="cliente">cliente</option>
                <option value="administrador">administrador</option>
              </select>
            </div>
            <button onClick={crearUsuario} className={styles.btnPrimary} style={{ marginTop: 12 }}>Crear</button>
          </div>

          <div className={styles.card}>
            <div className={styles.usersHeader}>
              <h3 className={styles.cardTitle} style={{ margin: 0}}>Usuarios ({usuariosFiltrados.length} / {usuarios.length})</h3>
              <div className={styles.usersFilters}>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={styles.select} style={{ minWidth: 140, fontSize: 12, padding: "6px 8px" }}>
                  <option value="todos">Todos los roles</option>
                  <option value="administrador">administrador</option>
                  <option value="miembro">miembro</option>
                  <option value="lider">lider</option>
                  <option value="cliente">cliente</option>
                </select>
                <input placeholder="Buscar por email, nombre o codigo MFS-" value={filtro} onChange={e => setFiltro(e.target.value)} className={styles.searchInput} />
              </div>
            </div>
            {cargando ? <div style={{ color: "white", fontSize: 13 }}>Cargando...</div> : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Codigo</th><th>Email</th><th>Nombre</th><th>Rol</th><th>Activo</th></tr></thead>
                    <tbody style={{backgroundColor: "white"}}>
                      {usuariosPaginados.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#6b7280" }}>No hay usuarios que coincidan.</td></tr>
                      ) : usuariosPaginados.map(u => {
                        const esAdmin = (u.roles ?? []).map(r => r.toLowerCase()).includes("administrador");
                        const rolActual = (u.roles ?? [])[0] ?? "sin rol";
                        return (
                          <tr key={u.id} style={{ opacity: esAdmin ? 0.6 : 1 }}>
                            <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#991b1b" }}>{(u as any).codigo ?? "-"}</td>
                            <td>{u.email}</td>
                            <td>{u.nombres} {u.apellidos}</td>
                            <td>
                              {esAdmin ? <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: 6, fontSize: 11 }}>Administrador</span> : (
                                <select value={rolActual.toLowerCase()} onChange={e => cambiarRol(u, e.target.value)} className={styles.select} style={{ padding: "4px 6px", fontSize: 12 }}>
                                  <option value="miembro">miembro</option>
                                  <option value="lider">lider</option>
                                  <option value="cliente">cliente</option>
                                </select>
                              )}
                            </td>
                            <td>
                              <Switch
                                checked={u.is_active}
                                disabled={esAdmin}
                                onChange={() => toggleActivo(u)}
                                label={u.is_active ? "Desactivar usuario" : "Activar usuario"}
                                title={esAdmin ? "No se puede modificar administradores" : u.is_active ? "Desactivar" : "Activar"}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={pageUsuarios} totalPages={totalPagesUsuarios} totalItems={usuariosFiltrados.length} pageSize={PAGE_SIZE_USUARIOS} onPageChange={setPageUsuarios} />
              </>
            )}
          </div>
        </div>
      )}

      {tab === "campanas" && (
        <div className={styles.container}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Registrar campaña / subcampaña</h3>
            <div className={styles.createToggle}>
              <button type="button" onClick={() => setTipoCreacion("campana")} className={tipoCreacion === "campana" ? styles.createToggleActive : styles.createToggleBtn}>Nueva campaña</button>
              <button type="button" onClick={() => setTipoCreacion("subcampana")} className={tipoCreacion === "subcampana" ? styles.createToggleActive : styles.createToggleBtn}>Nueva subcampaña</button>
            </div>
            {tipoCreacion === "campana" ? (
              <div className={styles.createForm}>
                <div className={styles.createField} style={{ position: "relative" }}>
                  <label style={{color: "black"}}>Nombre campaña *</label>
                  <input placeholder="Ej: BBVA, CSC, BCP..." value={nuevaCampanaNombre} onChange={e => setNuevaCampanaNombre(e.target.value)} className={styles.input} />
                  {campanaDuplicada && (
                    <div className={styles.dupWarning}>Ya existe una campaña con ese nombre.</div>
                  )}
                  {!campanaDuplicada && sugerenciasCampana.length > 0 && (
                    <div className={styles.sugerencias}>
                      <div className={styles.sugerenciasTitle}>Campañas existentes similares:</div>
                      {sugerenciasCampana.map(c => (
                        <div key={c.id} className={styles.sugerenciaItem}>
                          {c.nombre} <span className={styles.sugerenciaCode}>({c.codigo})</span> {c.activo ? "" : "— inactiva"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={crearCampana} disabled={creandoCampana || !nuevaCampanaNombre.trim() || campanaDuplicada} className={styles.btnPrimary} style={{ opacity: creandoCampana || !nuevaCampanaNombre.trim() || campanaDuplicada ? 0.6 : 1 }}>{creandoCampana ? "Creando..." : "Crear campaña"}</button>
              </div>
            ) : (
              <div className={styles.createForm}>
                <div className={styles.createField}>
                  <label style={{color: "black"}}>Campaña padre *</label>
                  <SearchableSelect
                    value={nuevaSubcampana.campanaId}
                    onChange={(v) => setNuevaSubcampana({ ...nuevaSubcampana, campanaId: v })}
                    options={opcionesCampana}
                    placeholder="Buscar campaña por nombre o código..."
                  />
                </div>
                <div className={styles.createField} style={{ position: "relative" }}>
                  <label style={{color: "black"}}>Nombre subcampaña *</label>
                  <input placeholder="Ej: Tarjetas Out, Digital..." value={nuevaSubcampana.nombre} onChange={e => setNuevaSubcampana({ ...nuevaSubcampana, nombre: e.target.value })} className={styles.input} />
                  <span className={styles.createHint}>El código se genera como CODIGO_CAMPANA_NOMBRE.</span>
                  {subcampanaDuplicada && (
                    <div className={styles.dupWarning}>Ya existe una subcampaña con ese nombre en la campaña seleccionada.</div>
                  )}
                  {!subcampanaDuplicada && sugerenciasSubcampana.length > 0 && (
                    <div className={styles.sugerencias}>
                      <div className={styles.sugerenciasTitle}>Subcampañas existentes similares:</div>
                      {sugerenciasSubcampana.map(s => (
                        <div key={s.id} className={styles.sugerenciaItem}>
                          {s.nombre} <span className={styles.sugerenciaCode}>({s.codigo})</span> {s.activo ? "" : "— inactiva"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={crearSubcampana} disabled={creandoCampana || !nuevaSubcampana.campanaId || !nuevaSubcampana.nombre.trim() || subcampanaDuplicada} className={styles.btnPrimary} style={{ opacity: creandoCampana || !nuevaSubcampana.campanaId || !nuevaSubcampana.nombre.trim() || subcampanaDuplicada ? 0.6 : 1 }}>{creandoCampana ? "Creando..." : "Crear subcampaña"}</button>
              </div>
            )}
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Estados de Campañas / Subcampañas</h3>
            <div className={styles.permisosHeader}>
              <div className={styles.permisosField} style={{ maxWidth: 400 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Buscar campaña/subcampaña</label>
                <input placeholder="Filtrar por campaña o subcampaña" value={filtroCampana} onChange={e => setFiltroCampana(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.permisosField} style={{ maxWidth: 220 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Estado</label>
                <select value={filtroActivoCampana} onChange={e => setFiltroActivoCampana(e.target.value as any)} className={styles.select}>
                  <option value="activos">Activas</option>
                  <option value="inactivos">Inactivas</option>
                  <option value="todos">Todas</option>
                </select>
              </div>
            </div>
            {campanasFiltradas.length > PAGE_SIZE_CAMPANAS && (
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>{campanasFiltradas.length} campaña(s) · Página {pageCampanas} de {totalPagesCampanas}</div>
            )}
            {campanasFiltradas.length > 1 && (
              <div className={styles.accordionActions}>
                <button type="button" onClick={expandirTodas} className={styles.linkBtn}>Expandir todo</button>
                <button type="button" onClick={colapsarTodas} className={styles.linkBtn}>Colapsar todo</button>
              </div>
            )}
            <div className={styles.campanasList}>
              {campanasFiltradas.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>{filtroActivoCampana === "activos" ? "No hay campañas activas." : filtroActivoCampana === "inactivos" ? "No hay campañas inactivas." : "No hay campañas que coincidan."}</div> : (
                campanasPaginadas.map(camp => {
                  const abierta = expandidas.has(camp.id);
                  return (
                    <div key={camp.id} className={styles.campanaCard}>
                      <div role="button" tabIndex={0} className={styles.campanaHead} onClick={() => toggleCampana(camp.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCampana(camp.id); } }} aria-expanded={abierta} style={{ cursor: "pointer" }}>
                        <div>
                          <span className={styles.campanaTitle}>{camp.nombre}</span> <span className={styles.campanaCode}>({camp.codigo})</span>
                          <span className={`${styles.badgeActive} ${camp.activo ? styles.badgeActiveOn : styles.badgeActiveOff}`}>{camp.activo ? "activa" : "inactiva"}</span>
                        </div>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Switch
                            checked={camp.activo}
                            loading={togglingId === camp.id}
                            onChange={() => toggleActivoCampana(camp)}
                            label={camp.activo ? "Inhabilitar campaña" : "Habilitar campaña"}
                            title={camp.activo ? "Inhabilitar campaña" : "Habilitar campaña"}
                          />
                          <span className={styles.campanaCount}>{camp.subcampanas.length} sub</span>
                          <span className={`${styles.chevron} ${abierta ? styles.chevronOpen : ""}`}>▸</span>
                        </span>
                      </div>
                      <div className={`${styles.campanaBody} ${abierta ? styles.campanaBodyOpen : ""}`}>
                        <div className={styles.campanaBodyInner}>
                          <div className={styles.subcampanasGrid}>
                          {camp.subcampanas.length === 0 ? <span style={{ fontSize: 12, color: "#9ca3af" }}>Sin subcampañas</span> : camp.subcampanas.map(sub => (
                            <div key={sub.id} className={styles.subLabel} style={{ opacity: !camp.activo || !sub.activo ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                              <div className={styles.subInfo}>
                                <div className={styles.subName}>{sub.nombre}</div>
                                <div className={styles.subCode}>{sub.codigo} {!sub.activo && "(inactiva)"} {!camp.activo && "(campaña inactiva)"}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className={`${styles.badgeActive} ${sub.activo && camp.activo ? styles.badgeActiveOn : styles.badgeActiveOff}`} style={{ fontSize: 10 }}>{sub.activo && camp.activo ? "habilitada" : "inhabilitada"}</span>
                                <Switch
                                  checked={sub.activo}
                                  loading={togglingId === sub.id}
                                  disabled={!camp.activo && !sub.activo}
                                  onChange={() => toggleActivoSubcampana(sub, camp.activo)}
                                  label={sub.activo ? "Inhabilitar subcampaña" : "Habilitar subcampaña"}
                                  title={!camp.activo && !sub.activo ? "La campaña está inhabilitada; habilítala primero" : sub.activo ? "Inhabilitar subcampaña" : "Habilitar subcampaña"}
                                />
                              </div>
                            </div>
                          ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Pagination page={pageCampanas} totalPages={totalPagesCampanas} totalItems={campanasFiltradas.length} pageSize={PAGE_SIZE_CAMPANAS} onPageChange={setPageCampanas} />
          </div>
        </div>
      )}

      {tab === "permisos" && (
        <div className={styles.container}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Permisos — Cliente → Subcampañas</h3>
            <p className={styles.permisosDesc}>Selecciona un usuario tipo <strong>cliente</strong> y marca las subcampañas a las que podrá solicitar tareas. El permiso es puntual por subcampaña (no hereda toda la campaña).</p>

            <div className={styles.permisosHeader}>
              <label className={styles.permisosField}>
                Cliente ({clientes.length} totales)
                <div className={styles.permisosFieldSmall} style={{ position: "relative" }}>
                  <input placeholder="Filtrar cliente por email/nombre/codigo" value={filtroClientePerm} onChange={e => setFiltroClientePerm(e.target.value)} className={styles.input} style={{ fontSize: 12 }} />
                  {filtroClientePerm && clientesFiltrados.length > 0 && (
                    <div className={styles.clienteDropdown}>
                      {clientesFiltrados.slice(0, 8).map(c => (
                        <div key={c.id} onClick={() => { setSelectedClienteId(c.id); setFiltroClientePerm(""); }} className={`${styles.clienteOption} ${selectedClienteId === c.id ? styles.clienteOptionActive : ""}`}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.codigo ?? c.id}</span> — {c.email} ({c.nombres} {c.apellidos})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedClienteId !== "" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#374151" }}>
                    <span>Seleccionado: <strong style={{ fontFamily: "monospace" }}>{usuarios.find(u => u.id === selectedClienteId)?.codigo ?? selectedClienteId}</strong> — {usuarios.find(u => u.id === selectedClienteId)?.email}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedClienteId(""); setFiltroClientePerm(""); }}
                      title="Quitar selección"
                      style={{ border: "1px solid #d1d5db", background: "white", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#b91c1c" }}
                    >
                      ✕ Quitar selección
                    </button>
                  </span>
                )}
              </label>

              <div className={styles.permisosField}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Buscar campaña/subcampaña</label>
                <input placeholder="Filtrar por campaña o subcampaña" value={filtroCampana} onChange={e => setFiltroCampana(e.target.value)} className={styles.input} />
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <select value={filtroActivoCampana} onChange={e => setFiltroActivoCampana(e.target.value as any)} className={styles.select} style={{ fontSize: 12, padding: "6px 8px" }}>
                    <option value="activos">Activas</option>
                    <option value="inactivos">Inactivas</option>
                    <option value="todos">Todas</option>
                  </select>
                </div>
                {selectedClienteId !== "" && (
                  <div className={`${styles.permisosStatus} ${buscandoPermisos ? styles.permisosStatusLoading : styles.permisosStatusOk}`}>
                    {buscandoPermisos ? "Cargando permisos..." : `${permisos.length} subcampaña(s) permitida(s) para este cliente`}
                    {cargandoPermisos && " — actualizando..."}
                  </div>
                )}
              </div>
            </div>

            {selectedClienteId !== "" && permisos.length > 0 && (
              <div className={styles.resumenCard}>
                <h4 className={styles.resumenTitle}>Resumen — subcampañas permitidas ({permisos.length})</h4>
                <div className={styles.chips}>
                  {permisos.map(p => (
                    <span key={p.id} className={styles.chip}>
                      <span style={{ fontWeight: 600 }}>{p.subcampana_nombre ?? p.subcampana}</span>
                      <span style={{ fontFamily: "monospace", color: "#6b7280" }}>({p.subcampana})</span>
                      <button onClick={async () => {
                        setCargandoPermisos(true);
                        try { await apiFetch(`/api/campanas/permisos/${p.id}/`, { method: "DELETE" }); setMsg(`Permiso revocado`); await cargarPermisos(Number(selectedClienteId)); } catch (e) { setMsg(`Error: ${(e as Error).message}`); } finally { setCargandoPermisos(false); }
                      }} className={styles.chipRemove}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedClienteId === "" ? (
              <div></div>
            ) : (
              <>
                {campanasFiltradas.length > PAGE_SIZE_CAMPANAS && (
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>{campanasFiltradas.length} campaña(s) · Página {pagePermisosCampanas} de {totalPagesPermisos}</div>
                )}
                {campanasFiltradas.length > 1 && (
                  <div className={styles.accordionActions}>
                    <button type="button" onClick={expandirTodasPermisos} className={styles.linkBtn}>Expandir todo</button>
                    <button type="button" onClick={colapsarTodas} className={styles.linkBtn}>Colapsar todo</button>
                  </div>
                )}
                <div className={styles.campanasList}>
                  {campanasFiltradas.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>{filtroActivoCampana === "activos" ? "No hay campañas activas que coincidan." : filtroActivoCampana === "inactivos" ? "No hay campañas inactivas que coincidan." : "No hay campañas que coincidan."}</div> : (
                    campanasPaginadasPermisos.map(camp => {
                      const abierta = expandidas.has(camp.id);
                      return (
                        <div key={camp.id} className={styles.campanaCard}>
                          <button type="button" className={styles.campanaHead} onClick={() => toggleCampana(camp.id)} aria-expanded={abierta} aria-controls={`campana-body-${camp.id}`}>
                            <div>
                              <span className={styles.campanaTitle}>{camp.nombre}</span> <span className={styles.campanaCode}>({camp.codigo})</span>
                              <span className={`${styles.badgeActive} ${camp.activo ? styles.badgeActiveOn : styles.badgeActiveOff}`}>{camp.activo ? "activa" : "inactiva"}</span>
                            </div>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={styles.campanaCount}>{camp.subcampanas.filter(s => permisosSubcampanaIds.has(s.id)).length}/{camp.subcampanas.length} permitidas</span>
                              <span className={`${styles.chevron} ${abierta ? styles.chevronOpen : ""}`}>▸</span>
                            </span>
                          </button>
                          <div id={`campana-body-${camp.id}`} className={`${styles.campanaBody} ${abierta ? styles.campanaBodyOpen : ""}`}>
                            <div className={styles.campanaBodyInner}>
                              <div className={styles.subcampanasGrid}>
                              {camp.subcampanas.length === 0 ? <span style={{ fontSize: 12, color: "#9ca3af" }}>Sin subcampañas</span> : camp.subcampanas.map(sub => {
                                const checked = permisosSubcampanaIds.has(sub.id);
                                return (
                                  <label key={sub.id} className={`${styles.subLabel} ${checked ? styles.subLabelChecked : ""} ${cargandoPermisos ? styles.subLabelDisabled : ""}`} style={{ opacity: sub.activo ? 1 : 0.6 }}>
                                    <input type="checkbox" checked={checked} disabled={cargandoPermisos || !sub.activo} onChange={e => togglePermiso(sub.id, e.target.checked)} style={{ width: 16, height: 16, accentColor: "#7c3aed" }} />
                                    <div className={styles.subInfo}>
                                      <div className={styles.subName}>{sub.nombre}</div>
                                      <div className={styles.subCode}>{sub.codigo} {!sub.activo && "(inactiva)"}</div>
                                    </div>
                                    {checked && <span className={styles.subBadge}>permitida</span>}
                                  </label>
                                );
                              })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <Pagination page={pagePermisosCampanas} totalPages={totalPagesPermisos} totalItems={campanasFiltradas.length} pageSize={PAGE_SIZE_CAMPANAS} onPageChange={setPagePermisosCampanas} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
