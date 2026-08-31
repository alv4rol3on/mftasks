"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";

type Usuario = { id:number; codigo?:string; email:string; nombres:string; apellidos:string; cargo?:string; is_active:boolean; roles?:string[] };

export default function AdminPage(){
  const router = useRouter();
  const [tab, setTab] = useState<"usuarios"|"equipos"|"permisos">("usuarios");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [filtro, setFiltro] = useState("");
  const [nuevo, setNuevo] = useState({email:"", nombres:"", apellidos:"", cargo:"", password:"", rol:"miembro"});

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
    try{
      await apiFetch(`/api/usuarios/usuarios/${u.id}/`, {method:"PATCH", body: JSON.stringify({is_active: !u.is_active})});
      setMsg(`${u.email} ${!u.is_active ? "activado":"desactivado"}`);
      await cargarUsuarios();
    }catch(e){ setMsg((e as Error).message); }
  };

  const usuariosFiltrados = usuarios.filter(u=>{
    if(!filtro) return true;
    const q=filtro.toLowerCase();
    return u.email.toLowerCase().includes(q) || `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) || (u.codigo??"").toLowerCase().includes(q);
  });

  if(!isAdmin) return <div style={{padding:16}}>Acceso denegado - solo administrador</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16}}>
      <h2 style={{ fontSize:18, fontWeight:700}}>Administracion</h2>
      <div style={{ display:"flex", gap:8, borderBottom:"1px solid #e5e7eb", paddingBottom:8}}>
        {(["usuarios","equipos","permisos"] as const).map(t=>(
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
              <input placeholder="Password (opcional)" type="password" value={nuevo.password} onChange={e=> setNuevo({...nuevo, password:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}/>
              <select value={nuevo.rol} onChange={e=> setNuevo({...nuevo, rol:e.target.value})} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px"}}>
                <option value="miembro">miembro</option>
                <option value="cliente">cliente</option>
                <option value="administrador">administrador</option>
              </select>
            </div>
            <p style={{ fontSize:11, color:"#6b7280", marginTop:6}}>El codigo MFS- se genera automaticamente. El rol define si puede ser agregado a equipos (miembro) o crear solicitudes (cliente).</p>
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
                  <thead><tr style={{ background:"#f9fafb", textAlign:"left"}}><th style={{ padding:"8px"}}>Codigo</th><th style={{ padding:"8px"}}>Email</th><th style={{ padding:"8px"}}>Nombre</th><th style={{ padding:"8px"}}>Cargo</th><th style={{ padding:"8px"}}>Activo</th><th style={{ padding:"8px"}}>Accion</th></tr></thead>
                  <tbody>
                    {usuariosFiltrados.map(u=>(
                      <tr key={u.id} style={{ borderTop:"1px solid #f3f4f6"}}>
                        <td style={{ padding:"8px", fontFamily:"monospace", fontSize:12, fontWeight:700}}>{(u as any).codigo ?? "-"}</td>
                        <td style={{ padding:"8px"}}>{u.email}</td>
                        <td style={{ padding:"8px"}}>{u.nombres} {u.apellidos}</td>
                        <td style={{ padding:"8px"}}>{u.cargo ?? "-"}</td>
                        <td style={{ padding:"8px"}}>{u.is_active ? "Si" : "No"}</td>
                        <td style={{ padding:"8px"}}><button onClick={()=> toggleActivo(u)} style={{ background: u.is_active ? "#fee2e2":"#dcfce7", color: u.is_active ? "#991b1b":"#166534", border:"1px solid #d1d5db", padding:"4px 8px", borderRadius:6, cursor:"pointer", fontSize:12}}>{u.is_active ? "Desactivar":"Activar"}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==="equipos" && (
        <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:12, padding:16}}>
          <h3 style={{ marginTop:0}}>Grupos (Equipos)</h3>
          <p style={{ fontSize:13, color:"#6b7280"}}>Los equipos se gestionan en <a href="/mfpages/equipos" style={{ color:"#2563eb", textDecoration:"underline"}}>Equipos</a>. Solo administrador puede crear equipos (nombre + lider). Los lideres agregan miembros por codigo MFS-.</p>
        </div>
      )}

      {tab==="permisos" && (
        <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:12, padding:16}}>
          <h3 style={{ marginTop:0}}>Permisos a clientes (Campanas/Subcampanas)</h3>
          <p style={{ fontSize:13, color:"#6b7280"}}>Asigna subcampanas permitidas por usuario en POST /api/campanas/permisos/ {"{usuario, subcampana}"}. Usa la pestana Usuarios para ver codigos.</p>
        </div>
      )}
    </div>
  );
}
