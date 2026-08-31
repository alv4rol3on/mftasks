"use client";

import { useState } from "react";
import styles from "./TaskModalDesarrollo.module.css";
import { Task } from "@/lib/types";
import { getUsuarioActual } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const formatter = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const formatearFecha = (fecha: string | null | undefined) => {
    if (!fecha) return "-";

    const date = new Date(fecha);

    if (isNaN(date.getTime())) return "-";

    return formatter.format(date);
};

type Props = {
    tarea: Task | null;
    onClose: () => void;
    onEmpezarTarea?: (tareaId: number, subtareaId: number) => void;
    onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
    onCambiarEstadoSubtarea?: (tareaId: number, subtareaId: number, nuevoEstado: string, motivo?: string) => void;
    empezandoId?: number | null;
    completandoId?: number | null;
};

export default function TaskModal({ tarea, onClose, onEmpezarTarea, onCompletarSubtarea, onCambiarEstadoSubtarea, empezandoId, completandoId }: Props) {
    const [depBloqueada, setDepBloqueada] = useState<number | "">("");
    const [depBloqueadora, setDepBloqueadora] = useState<number | "">("");
    const [depMsg, setDepMsg] = useState<string | null>(null);

    const agregarDependencia = async () => {
        if(!tarea || depBloqueada==="" || depBloqueadora==="") { setDepMsg("Selecciona ambas subtareas"); return; }
        if(depBloqueada===depBloqueadora) { setDepMsg("No puede depender de sí misma"); return; }
        try {
            await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${depBloqueada}/dependencias/`, { method:"POST", body: JSON.stringify({ bloqueadora_id: depBloqueadora }) });
            setDepMsg("Dependencia creada. Recarga la tarea.");
            setDepBloqueada(""); setDepBloqueadora("");
            // trigger parent reload via close/reopen or just message
        } catch(e){ setDepMsg((e as Error).message); }
    };
    if (!tarea) return null;
    const usuario = getUsuarioActual();

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <div>
                        <h2>Tarea #{tarea.id}</h2>
                        <p>{tarea.asunto}</p>
                    </div>

                    <button className={styles.close} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.modalBody}>

                    <div className={styles.modalColumn}>
                        <h3>Información</h3>

                        <table className={styles.infoTable}>
                            <tbody>
                                <tr>
                                    <td><strong>Solicitante</strong></td>
                                    <td>{tarea.solicitante_nombre}</td>
                                </tr>

                                <tr>
                                    <td><strong>Cliente</strong></td>
                                    <td>{tarea.cliente_nombre}</td>
                                </tr>
                                {tarea.subcampana_nombre && (
                                <tr>
                                    <td><strong>Subcampaña</strong></td>
                                    <td>{tarea.subcampana_nombre} {tarea.campana_nombre ? `(${tarea.campana_nombre})` : ""}</td>
                                </tr>
                                )}

                                <tr>
                                    <td><strong>Equipo</strong></td>
                                    <td>{tarea.equipo_nombre}</td>
                                </tr>

                                <tr>
                                    <td><strong>Estado</strong></td>
                                    <td>{tarea.estado}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de solicitud</strong></td>
                                    <td>{formatearFecha(tarea.fecha_creacion)}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de inicio</strong></td>
                                    <td>{formatearFecha(tarea.fecha_inicio)}</td>
                                </tr>

                                <tr>
                                    <td><strong>Fecha de entrega aproximada</strong></td>
                                    <td>{formatearFecha(tarea.fecha_entrega_aproximada)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.modalColumn}>
                        <h3>Descripción</h3>

                        <div className={styles.descriptionBox}>
                            {tarea.descripcion}
                        </div>
                    </div>

                    <div className={styles.progresoSection}>
                        <h3>Progreso {tarea.subcampana_nombre ? `• ${tarea.subcampana_nombre}` : ""}</h3>

                        {tarea.subtareas.length === 0 ? (
                            <p className={styles.sinSubtareas}>
                                Esta tarea ha sido aprobada y se encuentra en proceso de asignación
                            </p>
                        ) : (
                            <div className={styles.subtareasContainer}>
                                <table className={styles.subtareasTable}>
                                    <thead>
                                        <tr>
                                            <th>Descripción</th>
                                            <th>Asignado</th>
                                            <th>Estado</th>
                                            <th>Peso</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {tarea.subtareas.map((subtarea) => {
                                            const esMiSubtarea = usuario?.id === subtarea.asignado;
                                            const bloqueadorasPendientes = subtarea.bloqueada_por?.filter(b => b.estado !== "SOLUCIONADO") ?? [];
                                            const bloqueada = bloqueadorasPendientes.length > 0;
                                            const bloqueadaTooltip = bloqueada ? `Bloqueada por: ${bloqueadorasPendientes.map(b=>`${b.descripcion} (${b.estado})`).join(", ")}` : "";
                                            const puedeEmpezar = esMiSubtarea && subtarea.estado === "EN_ESPERA" && !!onEmpezarTarea && !bloqueada;
                                            const puedeCompletar = esMiSubtarea && subtarea.estado === "EN_DESARROLLO" && !!onCompletarSubtarea;
                                            const estadoColor = subtarea.estado === "STAND_BY" ? "#f59e0b" : subtarea.estado === "SOLUCIONADO" ? "#16a34a" : subtarea.estado === "EN_DESARROLLO" ? "#7c3aed" : "#6b7280";
                                            return (
                                                <tr
                                                    key={subtarea.id}
                                                    title={bloqueadaTooltip || subtarea.motivo_standby || ""}
                                                    className={
                                                        subtarea.estado === "EN_ESPERA"
                                                            ? styles.estadoEnEspera
                                                            : subtarea.estado === "EN_DESARROLLO"
                                                                ? styles.estadoEnDesarrollo
                                                                : subtarea.estado === "SOLUCIONADO"
                                                                    ? styles.estadoSolucionado
                                                                    : subtarea.estado === "STAND_BY"
                                                                        ? styles.estadoEnEspera
                                                                        : ""
                                                    }
                                                >
                                                    <td>{subtarea.descripcion} {bloqueada && <span style={{ background:"#fee2e2", color:"#991b1b", fontSize:10, padding:"2px 6px", borderRadius:6}}>Bloqueada</span>} {subtarea.motivo_standby && <span style={{ color:"#92400e", fontSize:11}}>({subtarea.motivo_standby})</span>}</td>
                                                    <td>{subtarea.asignado_nombre}</td>
                                                    <td style={{ color: estadoColor, fontWeight:600}}>{subtarea.estado}{bloqueada ? " ⏳" : ""}</td>
                                                    <td>{subtarea.peso}</td>
                                                    <td>
                                                        {esMiSubtarea && onCambiarEstadoSubtarea ? (
                                                            <select
                                                                value={subtarea.estado}
                                                                onChange={(e)=>{
                                                                    const nuevo = e.target.value;
                                                                    // si está bloqueada no permitir pasar a EN_DESARROLLO
                                                                    if(bloqueada && nuevo==="EN_DESARROLLO"){
                                                                        alert(`Bloqueada por: ${bloqueadorasPendientes.map(b=>b.descripcion).join(", ")} - debe solucionarse primero`);
                                                                        return;
                                                                    }
                                                                    if(nuevo==="STAND_BY"){
                                                                        const motivo = prompt("Motivo de pausa (STAND_BY) obligatorio:");
                                                                        if(!motivo || !motivo.trim()) { return; }
                                                                        onCambiarEstadoSubtarea(tarea.id, subtarea.id, nuevo, motivo.trim());
                                                                    } else {
                                                                        onCambiarEstadoSubtarea(tarea.id, subtarea.id, nuevo);
                                                                    }
                                                                }}
                                                                disabled={bloqueada && subtarea.estado==="EN_ESPERA"}
                                                                style={{ border:"1px solid #d1d5db", borderRadius:6, padding:"4px 6px", fontSize:12, background: bloqueada ? "#f3f4f6":"white", cursor: bloqueada ? "not-allowed":"pointer"}}
                                                                title={bloqueadaTooltip || "Cambiar estado (solo tu subtarea)"}
                                                            >
                                                                <option value="EN_ESPERA">En espera</option>
                                                                <option value="EN_DESARROLLO">En desarrollo</option>
                                                                <option value="STAND_BY">Stand-by</option>
                                                                <option value="SOLUCIONADO">Solucionado</option>
                                                            </select>
                                                        ) : puedeEmpezar ? (
                                                            <button
                                                                onClick={() =>
                                                                    onEmpezarTarea!(tarea.id, subtarea.id)
                                                                }
                                                                disabled={empezandoId === subtarea.id}
                                                                title={bloqueadaTooltip}
                                                                style={{
                                                                    background: bloqueada ? "#9ca3af" : "#0891b2",
                                                                    color: "white",
                                                                    border: "none",
                                                                    padding: "4px 10px",
                                                                    borderRadius: 6,
                                                                    cursor: bloqueada ? "not-allowed" : "pointer",
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                {bloqueada ? "Bloqueada" : empezandoId === subtarea.id ? "Iniciando…" : "Empezar"}
                                                            </button>
                                                        ) : puedeCompletar ? (
                                                            <button
                                                                onClick={() =>
                                                                    onCompletarSubtarea!(tarea.id, subtarea.id)
                                                                }
                                                                disabled={completandoId === subtarea.id}
                                                                style={{
                                                                    background: "#16a34a",
                                                                    color: "white",
                                                                    border: "none",
                                                                    padding: "4px 10px",
                                                                    borderRadius: 6,
                                                                    cursor: "pointer",
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                {completandoId === subtarea.id
                                                                    ? "Guardando…"
                                                                    : "Marcar como completado"}
                                                            </button>
                                                        ) : subtarea.estado === "SOLUCIONADO" ? (
                                                            <span style={{ color: "#FFFFFF", fontSize: 12 }}>
                                                                ✓ Terminada
                                                            </span>
                                                        ) : subtarea.estado === "STAND_BY" ? (
                                                            <span style={{ color:"#f59e0b", fontSize:11, fontWeight:600}}>Pausada</span>
                                                        ) : (
                                                            <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {tarea.subtareas.length > 1 && tarea.puedo_operar && (
                            <div style={{ marginTop:12, border:"1px solid #e5e7eb", borderRadius:8, padding:12, background:"#fafafa"}}>
                                <h4 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700}}>Dependencias (subtarea bloquea otra)</h4>
                                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"end"}}>
                                    <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:12}}>Bloqueada (espera)
                                        <select value={depBloqueada} onChange={e=>setDepBloqueada(e.target.value ? Number(e.target.value) : "")} style={{ border:"1px solid #d1d5db", borderRadius:6, padding:"6px 8px"}}>
                                            <option value="">-- subtarea --</option>
                                            {tarea.subtareas.map(s=><option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0,30)}</option>)}
                                        </select>
                                    </label>
                                    <span style={{ paddingBottom:8}}>depende de</span>
                                    <label style={{ display:"flex", flexDirection:"column", gap:4, fontSize:12}}>Bloqueadora (prerequisito)
                                        <select value={depBloqueadora} onChange={e=>setDepBloqueadora(e.target.value ? Number(e.target.value) : "")} style={{ border:"1px solid #d1d5db", borderRadius:6, padding:"6px 8px"}}>
                                            <option value="">-- subtarea --</option>
                                            {tarea.subtareas.map(s=><option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0,30)}</option>)}
                                        </select>
                                    </label>
                                    <button onClick={agregarDependencia} style={{ background:"#7c3aed", color:"white", border:"none", padding:"8px 12px", borderRadius:6, cursor:"pointer", fontSize:12}}>Agregar dependencia</button>
                                </div>
                                {depMsg && <p style={{ fontSize:12, color: depMsg.includes("creada") ? "#166534" : "#991b1b", margin:"8px 0 0"}}>{depMsg}</p>}
                                <p style={{ fontSize:11, color:"#6b7280", margin:"6px 0 0"}}>No puede iniciarse la bloqueada hasta que la bloqueadora esté SOLUCIONADO. Se detecta ciclo.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}