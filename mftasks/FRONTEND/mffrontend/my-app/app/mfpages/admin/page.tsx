"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import styles from "./Admin.module.css";

type Usuario = { id: number; codigo?: string; email: string; nombres: string; apellidos: string; cargo?: string; is_active: boolean; roles?: string[] };
type CampanaPerm = { id: number; nombre: string; codigo: string; subcampanas: { id: number; nombre: string; codigo: string; activo: boolean; campana: number }[]; activo: boolean };
type Permiso = { id: number; usuario: number; usuario_email: string; subcampana: number | null; subcampana_nombre: string | null; campana: number | null; campana_nombre: string | null };

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"usuarios" | "permisos">("usuarios");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [nuevo, setNuevo] = useState({ email: "", nombres: "", apellidos: "", cargo: "", password: "", rol: "miembro" });
  const [selectedClienteId, setSelectedClienteId] = useState<number | "">("");
  const [filtroClientePerm, setFiltroClientePerm] = useState("");
  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [buscandoPermisos, setBuscandoPermisos] = useState(false);
  const [filtroCampana, setFiltroCampana] = useState("");
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());

  const user = getUsuarioActual();
  const isAdmin = (user?.roles ?? []).map(r => r.toLowerCase()).includes("administrador");
  useEffect(() => { if (!isAdmin) router.replace("/mfpages/home"); }, [isAdmin, router]);

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
    if (!filtro) return true;
    const q = filtro.toLowerCase();
    return u.email.toLowerCase().includes(q) || `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) || (u.codigo ?? "").toLowerCase().includes(q);
  });

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
  useEffect(() => { if (tab === "permisos") { cargarCampanas(); } }, [tab]);
  useEffect(() => { if (selectedClienteId !== "") cargarPermisos(Number(selectedClienteId)); else setPermisos([]); }, [selectedClienteId]);

  // Acordeón: colapsadas por defecto con animación simple
  const toggleCampana = (id: number) => setExpandidas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandirTodas = () => setExpandidas(new Set(campanasFiltradas.map(c => c.id)));
  const colapsarTodas = () => setExpandidas(new Set());

  // Auto-expandir cuando se busca campaña/subcampaña
  useEffect(() => {
    if (filtroCampana.trim()) {
      setExpandidas(new Set(campanasFiltradas.map(c => c.id)));
    }
  }, [filtroCampana]);

  // Colapsar al cambiar de cliente (evita mostrar todo apretado)
  useEffect(() => { setExpandidas(new Set()); }, [selectedClienteId]);

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

  const permisosSubcampanaIds = new Set(permisos.filter(p => p.subcampana != null).map(p => p.subcampana as number));
  const campanasFiltradas = campanas.filter(c => {
    if (!filtroCampana) return true;
    const q = filtroCampana.toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.subcampanas.some(s => s.nombre.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q));
  });

  if (!isAdmin) return <div style={{ padding: 16 }}>Acceso denegado - solo administrador</div>;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Administración de usuarios</h2>
      <div className={styles.tabs}>
        {(["usuarios", "permisos"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? styles.tabBtnActive : styles.tabBtn}>{t}</button>
        ))}
      </div>
      {msg && <div className={`${styles.msg} ${msg.startsWith("Error") ? styles.msgError : styles.msgSuccess}`}>{msg}</div>}

      {tab === "usuarios" && (
        <div className={styles.container}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Crear usuario</h3>
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
            <button onClick={crearUsuario} className={styles.btnPrimary} style={{ marginTop: 12 }}>Crear usuario</button>
          </div>

          <div className={styles.card}>
            <div className={styles.usersHeader}>
              <h3 className={styles.cardTitle} style={{ margin: 0 }}>Usuarios ({usuariosFiltrados.length})</h3>
              <input placeholder="Buscar por email, nombre o codigo MFS-" value={filtro} onChange={e => setFiltro(e.target.value)} className={styles.searchInput} />
            </div>
            {cargando ? <div>Cargando...</div> : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Codigo</th><th>Email</th><th>Nombre</th><th>Rol</th><th>Activo</th><th>Accion</th></tr></thead>
                  <tbody>
                    {usuariosFiltrados.map(u => {
                      const esAdmin = (u.roles ?? []).map(r => r.toLowerCase()).includes("administrador");
                      const rolActual = (u.roles ?? [])[0] ?? "sin rol";
                      return (
                        <tr key={u.id} style={{ opacity: esAdmin ? 0.6 : 1 }}>
                          <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{(u as any).codigo ?? "-"}</td>
                          <td>{u.email}</td>
                          <td>{u.nombres} {u.apellidos}</td>
                          <td>
                            {esAdmin ? <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: 6, fontSize: 11 }}>Administrador (bloqueado)</span> : (
                              <select value={rolActual.toLowerCase()} onChange={e => cambiarRol(u, e.target.value)} className={styles.select} style={{ padding: "4px 6px", fontSize: 12 }}>
                                <option value="miembro">miembro</option>
                                <option value="lider">lider</option>
                                <option value="cliente">cliente</option>
                              </select>
                            )}
                          </td>
                          <td>{u.is_active ? "Si" : "No"}</td>
                          <td>
                            <button disabled={esAdmin} onClick={() => toggleActivo(u)} style={{ background: esAdmin ? "#f3f4f6" : u.is_active ? "#fee2e2" : "#dcfce7", color: esAdmin ? "#9ca3af" : u.is_active ? "#991b1b" : "#166534", border: "1px solid #d1d5db", padding: "4px 8px", borderRadius: 6, cursor: esAdmin ? "not-allowed" : "pointer", fontSize: 12 }}>{u.is_active ? "Desactivar" : "Activar"}</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                        <div key={c.id} onClick={() => setSelectedClienteId(c.id)} className={`${styles.clienteOption} ${selectedClienteId === c.id ? styles.clienteOptionActive : ""}`}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.codigo ?? c.id}</span> — {c.email} ({c.nombres} {c.apellidos})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedClienteId !== "" && (
                  <span style={{ fontSize: 12, color: "#374151" }}>Seleccionado: <strong style={{ fontFamily: "monospace" }}>{usuarios.find(u => u.id === selectedClienteId)?.codigo ?? selectedClienteId}</strong> — {usuarios.find(u => u.id === selectedClienteId)?.email}</span>
                )}
              </label>

              <div className={styles.permisosField}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Buscar campaña/subcampaña</label>
                <input placeholder="Filtrar por campaña o subcampaña" value={filtroCampana} onChange={e => setFiltroCampana(e.target.value)} className={styles.input} />
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
              <div className={styles.emptyPermisos}>Selecciona un cliente arriba para ver y otorgar subcampañas. Solo usuarios con rol <code>cliente</code> aparecen aquí.</div>
            ) : (
              <>
                {campanasFiltradas.length > 1 && (
                  <div className={styles.accordionActions}>
                    <button type="button" onClick={expandirTodas} className={styles.linkBtn}>Expandir todo</button>
                    <button type="button" onClick={colapsarTodas} className={styles.linkBtn}>Colapsar todo</button>
                  </div>
                )}
                <div className={styles.campanasList}>
                  {campanasFiltradas.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>No hay campañas que coincidan.</div> : (
                    campanasFiltradas.map(camp => {
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
