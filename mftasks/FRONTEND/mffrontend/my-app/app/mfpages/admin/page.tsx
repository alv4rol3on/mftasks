"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";

type Usuario = { id:number; codigo?:string; email:string; nombres:string; apellidos:string; cargo?:string; is_active:boolean; roles?:string[] };
type CampanaPerm = { id:number; nombre:string; codigo:string; subcampanas:{id:number; nombre:string; codigo:string; activo:boolean; campana:number}[]; activo:boolean };
type Permiso = { id:number; usuario:number; usuario_email:string; subcampana:number | null; subcampana_nombre:string | null; campana:number | null; campana_nombre:string | null };

export default function AdminPage(){
  const router = useRouter();
  const [tab, setTab] = useState<"usuarios"|"permisos">("usuarios");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [filtro, setFiltro] = useState("");
  const [nuevo, setNuevo] = useState({email:"", nombres:"", apellidos:"", cargo:"", password:"", rol:"miembro"});
  // permisos state
  const [selectedClienteId, setSelectedClienteId] = useState<number | "">("");
  const [filtroClientePerm, setFiltroClientePerm] = useState("");
  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [buscandoPermisos, setBuscandoPermisos] = useState(false);
  const [filtroCampana, setFiltroCampana] = useState("");

  const user = getUsuarioActual();
  const isAdmin = (user?.roles ?? []).map(r=>r.toLowerCase()).includes("administrador");
  useEffect(()=>{ if(!isAdmin) router.replace("/mfpages/home"); },[isAdmin, router]);

  const cargarUsuarios = async()=>{
    setCargando(true);
    try{
      const data = await apiFetch<Usuario[] | {results:Usuario[]}>("/api/usuarios/usuarios/");
      const arr = Array.isArray(data) ? data : (data as any).results ?? [];
      setUsuarios(arr);
    }catch(e){ setMsg((e as Error).message); }
    finally{ setCargando(false); }
  };
  useEffect(()=>{ cargarUsuarios(); },[]);

  const crearUsuario = async()=>{
    if(!nuevo.email || !nuevo.nombres || !nuevo.apellidos){ setMsg("Email, nombres y apellidos obligatorios"); return; }
    try{
      await apiFetch("/api/usuarios/usuarios/", {method:"POST", body: JSON.stringify({email:nuevo.email, nombres:nuevo.nombres, apellidos:nuevo.apellidos, cargo:nuevo.cargo, password:nuevo.password || undefined, roles:[nuevo.rol]})});
      setMsg(`Usuario ${nuevo.email} creado con rol ${nuevo.rol} y codigo auto-generado`);
      setNuevo({email:"", nombres:"", apellidos:"", cargo:"", password:"", rol:"miembro"});
      await cargarUsuarios();
    }catch(e){ setMsg(`Error: ${(e as Error).message}`); }
  };

  const toggleActivo = async(u:Usuario)=>{
    if((u.roles??[]).map(r=>r.toLowerCase()).includes("administrador")){
      setMsg("Error: No se puede modificar usuarios administradores");
      return;
    }
    try{
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, {method:"PATCH", body: JSON.stringify({is_active: !u.is_active})});
      setMsg(`${u.email} ${!u.is_active ? "activado":"desactivado"}`);
      await cargarUsuarios();
    }catch(e){ setMsg((e as Error).message); }
  };

  const cambiarRol = async(u:Usuario, nuevoRol:string)=>{
    if((u.roles??[]).map(r=>r.toLowerCase()).includes("administrador")){
      setMsg("Error: No se puede modificar rol de administradores");
      return;
    }
    if(!["miembro","lider","cliente"].includes(nuevoRol.toLowerCase())){
      setMsg("Rol no permitido");
      return;
    }
    try{
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, {method:"PATCH", body: JSON.stringify({roles: [nuevoRol]})});
      setMsg(`Rol de ${u.email} cambiado a ${nuevoRol}`);
      await cargarUsuarios();
    }catch(e){ setMsg(`Error: ${(e as Error).message}`); }
  };

  const usuariosFiltrados = usuarios.filter(u=>{
    if(!filtro) return true;
    const q=filtro.toLowerCase();
    return u.email.toLowerCase().includes(q) || `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) || (u.codigo??"").toLowerCase().includes(q);
  });

  // === Permisos logic ===
  const clientes = usuarios.filter(u=> (u.roles??[]).map(r=>r.toLowerCase()).includes("cliente"));
  const clientesFiltrados = clientes.filter(u=>{
    if(!filtroClientePerm) return true;
    const q=filtroClientePerm.toLowerCase();
    return u.email.toLowerCase().includes(q) || `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) || (u.codigo??"").toLowerCase().includes(q);
  });

  const cargarCampanas = async()=>{
    try{
      const data = await apiFetch<CampanaPerm[] | {results:CampanaPerm[]}>("/api/campanas/campanas/");
      const arr = Array.isArray(data) ? data : (data as any).results ?? [];
      setCampanas(arr);
    }catch{ setCampanas([]); }
  };
  const cargarPermisos = async(usuarioId:number)=>{
    setBuscandoPermisos(true);
    try{
      const data = await apiFetch<Permiso[] | {results:Permiso[]}>(`/api/campanas/permisos/?usuario=${usuarioId}`);
      const arr = Array.isArray(data) ? data : (data as any).results ?? [];
      setPermisos(arr);
    }catch(e){ setMsg(`Error cargando permisos: ${(e as Error).message}`); setPermisos([]); }
    finally{ setBuscandoPermisos(false); }
  };
  useEffect(()=>{ if(tab==="permisos"){ cargarCampanas(); } },[tab]);
  useEffect(()=>{ if(selectedClienteId !== "") cargarPermisos(Number(selectedClienteId)); else setPermisos([]); },[selectedClienteId]);

  const togglePermiso = async(subcampanaId:number, checked:boolean)=>{
    if(selectedClienteId===""){ setMsg("Error: selecciona un cliente primero"); return; }
    const clienteId = Number(selectedClienteId);
    setCargandoPermisos(true);
    try{
      if(checked){
        // otorgar
        await apiFetch("/api/campanas/permisos/", {method:"POST", body: JSON.stringify({usuario: clienteId, subcampana: subcampanaId})});
        setMsg(`Permiso otorgado para subcampaña ${subcampanaId}`);
      }else{
        // revocar: buscar permiso id
        const perm = permisos.find(p=> p.subcampana===subcampanaId);
        if(!perm){ setMsg("Error: permiso no encontrado"); return; }
        await apiFetch(`/api/campanas/permisos/${perm.id}/`, {method:"DELETE"});
        setMsg(`Permiso revocado para subcampaña ${subcampanaId}`);
      }
      await cargarPermisos(clienteId);
    }catch(e){ setMsg(`Error: ${(e as Error).message}`); }
    finally{ setCargandoPermisos(false); }
  };

  const permisosSubcampanaIds = new Set(permisos.filter(p=>p.subcampana!=null).map(p=> p.subcampana as number));
  const campanasFiltradas = campanas.filter(c=>{
    if(!filtroCampana) return true;
    const q=filtroCampana.toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.subcampanas.some(s=> s.nombre.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q));
  });

  if(!isAdmin) return <div style={{padding:16}}>Acceso denegado - solo administrador</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16}}>
      <h2 style={{ fontSize:18, fontWeight:700}}>Administración de usuarios</h2>
      <div style={{ display:"flex", gap:8, borderBottom:"1px solid #e5e7eb", paddingBottom:8}}>
        {(["usuarios","permisos"] as const).map(t=>(
          <button key={t} onClick={()=> setTab(t)} style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #d1d5db", background: tab===t ? "#111827":"white", color: tab===t ? "white":"#374151", cursor:"pointer", textTransform:"capitalize"}}>{t}</button>
        ))}
      </div>
      {msg && <div style={{ background: msg.startsWith("Error") ? "#fee2e2":"#dcfce7", color: msg.startsWith("Error") ? "#991b1b":"#166534", padding:10, borderRadius:8, fontSize:13}}>{msg}</div>}

      {tab==="usuarios" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16}}>
          <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:12, padding:16}}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700}}>Crear usuario</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <input placeholder="Email" value={nuevo.email} onChange={e=> setNuevo({...nuevo, email:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}/>
              <input placeholder="Cargo" value={nuevo.cargo} onChange={e=> setNuevo({...nuevo, cargo:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}/>
              <input placeholder="Nombres" value={nuevo.nombres} onChange={e=> setNuevo({...nuevo, nombres:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}/>
              <input placeholder="Apellidos" value={nuevo.apellidos} onChange={e=> setNuevo({...nuevo, apellidos:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}/>
              <input placeholder="Password" type="password" value={nuevo.password} onChange={e=> setNuevo({...nuevo, password:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}/>
              <select value={nuevo.rol} onChange={e=> setNuevo({...nuevo, rol:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}>
                <option value="miembro">miembro</option>
                <option value="lider">lider</option>
                <option value="cliente">cliente</option>
                <option value="administrador">administrador</option>
              </select>
            </div>
            <button onClick={crearUsuario} style={{ marginTop:12, background:"#111827", color:"white", border:"none", padding:"8px 14px", borderRadius:8, cursor:"pointer"}}>Crear usuario</button>
          </div>

          <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:12, padding:16}}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700}}>Usuarios ({usuariosFiltrados.length})</h3>
              <input placeholder="Buscar por email, nombre o codigo MFS-" value={filtro} onChange={e=> setFiltro(e.target.value)} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"6px 10px", fontSize:13, minWidth:240}}/>
            </div>
            {cargando ? <div>Cargando...</div> : (
              <div style={{ overflowX:"auto", maxHeight:"60vh", overflowY:"auto"}}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13}}>
                  <thead><tr style={{ background:"#f9fafb", textAlign:"left"}}><th style={{ padding:"8px"}}>Codigo</th><th style={{ padding:"8px"}}>Email</th><th style={{ padding:"8px"}}>Nombre</th><th style={{ padding:"8px"}}>Rol</th><th style={{ padding:"8px"}}>Activo</th><th style={{ padding:"8px"}}>Accion</th></tr></thead>
                  <tbody>
                    {usuariosFiltrados.map(u=>{
                      const esAdmin = (u.roles??[]).map(r=>r.toLowerCase()).includes("administrador");
                      const rolActual = (u.roles??[])[0] ?? "sin rol";
                      return (
                      <tr key={u.id} style={{ borderTop:"1px solid #f3f4f6", opacity: esAdmin ? 0.6 : 1}}>
                        <td style={{ padding:"8px", fontFamily:"monospace", fontSize:12, fontWeight:700}}>{(u as any).codigo ?? "-"}</td>
                        <td style={{ padding:"8px"}}>{u.email}</td>
                        <td style={{ padding:"8px"}}>{u.nombres} {u.apellidos}</td>
                        <td style={{ padding:"8px"}}>
                          {esAdmin ? <span style={{ background:"#fee2e2", color:"#991b1b", padding:"2px 6px", borderRadius:6, fontSize:11}}>Administrador (bloqueado)</span> : (
                            <select value={rolActual.toLowerCase()} onChange={e=> cambiarRol(u, e.target.value)} style={{ border:"1px solid #d1d5db", borderRadius:6, padding:"4px 6px", fontSize:12}}>
                              <option value="miembro">miembro</option>
                              <option value="lider">lider</option>
                              <option value="cliente">cliente</option>
                            </select>
                          )}
                        </td>
                        <td style={{ padding:"8px"}}>{u.is_active ? "Si" : "No"}</td>
                        <td style={{ padding:"8px", display:"flex", gap:6}}>
                          <button disabled={esAdmin} onClick={()=> toggleActivo(u)} style={{ background: esAdmin ? "#f3f4f6" : u.is_active ? "#fee2e2":"#dcfce7", color: esAdmin ? "#9ca3af" : u.is_active ? "#991b1b":"#166534", border:"1px solid #d1d5db", padding:"4px 8px", borderRadius:6, cursor: esAdmin ? "not-allowed":"pointer", fontSize:12}}>{u.is_active ? "Desactivar":"Activar"}</button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==="permisos" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16}}>
          <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:12, padding:16}}>
            <h3 style={{ margin:"0 0 8px", fontSize:14, fontWeight:700}}>Permisos — Cliente → Subcampañas</h3>
            <p style={{ fontSize:12, color:"#6b7280", margin:"0 0 12px"}}>Selecciona un usuario tipo <strong>cliente</strong> y marca las subcampañas a las que podrá solicitar tareas. El permiso es puntual por subcampaña (no hereda toda la campaña).</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
              <label style={{ display:"flex", flexDirection:"column", gap:6, fontSize:13, fontWeight:600}}>
                Cliente ({clientes.length} totales)
                <div style={{ display:"flex", gap:8}}>
                  <select value={selectedClienteId} onChange={e=> setSelectedClienteId(e.target.value ? Number(e.target.value) : "")} style={{ flex:1, border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px", fontSize:13}}>
                    <option value="">— Seleccionar cliente —</option>
                    {clientes.map(c=> <option key={c.id} value={c.id}>{c.email} — {c.nombres} {c.apellidos} [{c.codigo ?? c.id}]</option>)}
                  </select>
                </div>
                <input placeholder="Filtrar cliente por email/nombre/codigo" value={filtroClientePerm} onChange={e=> setFiltroClientePerm(e.target.value)} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"6px 10px", fontSize:12, marginTop:6}}/>
                {filtroClientePerm && clientesFiltrados.length>0 && (
                  <div style={{ border:"1px solid #e5e7eb", borderRadius:8, maxHeight:120, overflowY:"auto", background:"#fafafa"}}>
                    {clientesFiltrados.slice(0,8).map(c=>(
                      <div key={c.id} onClick={()=> setSelectedClienteId(c.id)} style={{ padding:"6px 10px", cursor:"pointer", fontSize:12, fontWeight:400, background: selectedClienteId===c.id ? "#ede9fe" : "transparent", borderBottom:"1px solid #f3f4f6"}}>
                        <span style={{ fontFamily:"monospace", fontWeight:700}}>{c.codigo ?? c.id}</span> — {c.email} ({c.nombres} {c.apellidos})
                      </div>
                    ))}
                  </div>
                )}
              </label>
              <div style={{ display:"flex", flexDirection:"column", gap:6}}>
                <label style={{ fontSize:13, fontWeight:600}}>Buscar campaña/subcampaña</label>
                <input placeholder="Filtrar por campaña o subcampaña" value={filtroCampana} onChange={e=> setFiltroCampana(e.target.value)} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px", fontSize:13}}/>
                {selectedClienteId !== "" && (
                  <div style={{ fontSize:12, color:"#374151", background: buscandoPermisos ? "#fef3c7" : "#dcfce7", padding:"6px 10px", borderRadius:8}}>
                    {buscandoPermisos ? "Cargando permisos..." : `${permisos.length} subcampaña(s) permitida(s) para este cliente`}
                    {cargandoPermisos && " — actualizando..."}
                  </div>
                )}
              </div>
            </div>
            {selectedClienteId === "" ? (
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", padding:12, borderRadius:8, fontSize:13, color:"#1e40af"}}>Selecciona un cliente arriba para ver y otorgar subcampañas. Solo usuarios con rol <code>cliente</code> aparecen aquí.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:12, maxHeight:"60vh", overflowY:"auto", paddingRight:4}}>
                {campanasFiltradas.length===0 ? <div style={{ fontSize:13, color:"#6b7280"}}>No hay campañas que coincidan.</div> : (
                  campanasFiltradas.map(camp=>(
                    <div key={camp.id} style={{ border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden"}}>
                      <div style={{ background:"#f9fafb", padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                        <div>
                          <span style={{ fontWeight:700, fontSize:13}}>{camp.nombre}</span> <span style={{ fontFamily:"monospace", fontSize:11, color:"#6b7280"}}>({camp.codigo})</span>
                          <span style={{ marginLeft:8, fontSize:11, color: camp.activo ? "#166534":"#991b1b", background: camp.activo ? "#dcfce7":"#fee2e2", padding:"2px 6px", borderRadius:999}}>{camp.activo ? "activa":"inactiva"}</span>
                        </div>
                        <span style={{ fontSize:11, color:"#6b7280"}}>{camp.subcampanas.filter(s=> permisosSubcampanaIds.has(s.id)).length}/{camp.subcampanas.length} permitidas</span>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:8, padding:12}}>
                        {camp.subcampanas.length===0 ? <span style={{ fontSize:12, color:"#9ca3af"}}>Sin subcampañas</span> : camp.subcampanas.map(sub=> {
                          const checked = permisosSubcampanaIds.has(sub.id);
                          return (
                            <label key={sub.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", border:"1px solid", borderColor: checked ? "#7c3aed":"#e5e7eb", background: checked ? "#ede9fe":"white", borderRadius:8, cursor: cargandoPermisos ? "wait":"pointer", opacity: sub.activo ? 1 : 0.6}}>
                              <input type="checkbox" checked={checked} disabled={cargandoPermisos || !sub.activo} onChange={e=> togglePermiso(sub.id, e.target.checked)} style={{ width:16, height:16, accentColor:"#7c3aed"}}/>
                              <div style={{ flex:1}}>
                                <div style={{ fontSize:12, fontWeight:600, color:"#111827"}}>{sub.nombre}</div>
                                <div style={{ fontSize:11, fontFamily:"monospace", color:"#6b7280"}}>{sub.codigo} { !sub.activo && "(inactiva)"}</div>
                              </div>
                              {checked && <span style={{ fontSize:10, background:"#7c3aed", color:"white", padding:"2px 6px", borderRadius:999}}>permitida</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            <div style={{ marginTop:10, fontSize:11, color:"#6b7280"}}>Tip: el cambio es inmediato (POST /api/campanas/permisos/ o DELETE). El cliente verá solo esas subcampañas en “Nueva solicitud”.</div>
          </div>

          {selectedClienteId !== "" && permisos.length>0 && (
            <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:12, padding:16}}>
              <h4 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700}}>Resumen — subcampañas permitidas ({permisos.length})</h4>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6}}>
                {permisos.map(p=>(
                  <span key={p.id} style={{ background:"#ede9fe", border:"1px solid #ddd6fe", padding:"4px 8px", borderRadius:999, fontSize:11, display:"flex", alignItems:"center", gap:6}}>
                    <span style={{ fontWeight:600}}>{p.subcampana_nombre ?? p.subcampana}</span>
                    <span style={{ fontFamily:"monospace", color:"#6b7280"}}>({p.subcampana})</span>
                    <button onClick={async()=>{
                      setCargandoPermisos(true);
                      try{ await apiFetch(`/api/campanas/permisos/${p.id}/`, {method:"DELETE"}); setMsg(`Permiso revocado`); await cargarPermisos(Number(selectedClienteId)); }catch(e){ setMsg(`Error: ${(e as Error).message}`);} finally{ setCargandoPermisos(false);}
                    }} style={{ background:"white", border:"1px solid #fecaca", color:"#991b1b", padding:"2px 6px", borderRadius:6, cursor:"pointer", fontSize:10, fontWeight:700}}>✕ revocar</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
