"use client";

import { Task } from "@/lib/types";

type Props = {
    tarea: Task;

    tab: "progreso" | "historial" | "asignaciones";
    setTab: (tab: "progreso" | "historial" | "asignaciones") => void;

    puedeVerHistorial: boolean;
    puedeVerAsignaciones: boolean;

    usuario: any;

    subtareasProgreso: Task["subtareas"];

    onEmpezarTarea?: (tareaId: number, subtareaId: number) => void;
    onCompletarSubtarea?: (tareaId: number, subtareaId: number) => void;
    onCambiarEstadoSubtarea?: (
        tareaId: number,
        subtareaId: number,
        nuevoEstado: string,
        motivo?: string
    ) => void;

    empezandoId?: number | null;
    completandoId?: number | null;

    abrirReanudar: (subtareaId: number) => void;
    agregarDependencia: () => void;

    depBloqueada: number | "";
    depBloqueadora: number | "";
    setDepBloqueada: (value: number | "") => void;
    setDepBloqueadora: (value: number | "") => void;
    depMsg: string | null;

    styles: Record<string, string>;
};

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

export default function TaskStateSection({
    tarea,
    tab,
    setTab,
    puedeVerHistorial,
    puedeVerAsignaciones,
    usuario,
    subtareasProgreso,
    onEmpezarTarea,
    onCompletarSubtarea,
    onCambiarEstadoSubtarea,
    empezandoId,
    completandoId,
    abrirReanudar,
    agregarDependencia,
    depBloqueada,
    depBloqueadora,
    setDepBloqueada,
    setDepBloqueadora,
    depMsg,
    styles,
}: Props) {

    if (tarea.estado === "EN_ESPERA") {
        return (
            <div>
                {/* Aquí irá el componente de aprobación */}
            </div>
        );
    }

    return (
        <div>
            <div>
                <button onClick={() => setTab("progreso")}>
                    Progreso
                </button>

                {puedeVerHistorial && (
                    <button onClick={() => setTab("historial")}>
                        Historial
                    </button>
                )}

                {puedeVerAsignaciones &&
                    tarea.estado !== "SOLUCIONADO" &&
                    tarea.estado !== "APROBADO" && (
                        <button onClick={() => setTab("asignaciones")}>
                            Asignaciones
                        </button>
                    )}
            </div>

            {tab === "progreso" && (
                <>
                    <h3>Progreso — Subtareas</h3>

                    {subtareasProgreso.length === 0 ? (
                        <p className={styles.sinSubtareas}>
                            {tarea.subtareas.length === 0
                                ? "Esta tarea se encuentra en proceso de revisión"
                                : "Todas las subtareas activas han sido inactivadas. Revisa Asignaciones."}
                        </p>
                    ) : (
                        <div className={styles.subtareasContainer}>
                            <table className={styles.subtareasTable}>
                                <thead>
                                    <tr>
                                        <th>Descripción</th>
                                        <th>Asignado</th>
                                        <th>Cambiar Estado</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {subtareasProgreso.map((subtarea) => {
                                        const esMiSubtarea = usuario?.id === subtarea.asignado;
                                        const bloqueadorasPendientes = subtarea.bloqueada_por?.filter(b => b.estado !== "SOLUCIONADO") ?? [];
                                        const bloqueada = bloqueadorasPendientes.length > 0;
                                        const bloqueadaTooltip = bloqueada ? `Bloqueada por: ${bloqueadorasPendientes.map(b => `${b.descripcion} (${b.estado})`).join(", ")}` : "";
                                        const puedeEmpezar = esMiSubtarea && subtarea.estado === "EN_ESPERA" && !!onEmpezarTarea && !bloqueada;
                                        const puedeCompletar = esMiSubtarea && subtarea.estado === "EN_DESARROLLO" && !!onCompletarSubtarea;
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
                                                                    ? styles.estadoEnStandBy
                                                                    : ""
                                                }
                                            >
                                                <td data-label="Descripción">
                                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{subtarea.codigo ? <span style={{ background: "#ede9fe", color: "#5b21b6", fontSize: 10, padding: "2px 6px", borderRadius: 6, marginRight: 6 }}>{subtarea.codigo}</span> : null}{subtarea.descripcion} {bloqueada && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, padding: "2px 6px", borderRadius: 6 }}>Bloqueada</span>}</div>

                                                    {subtarea.estado !== "STAND_BY" ?
                                                        <div style={{ fontSize: 10, color: "#6b7280" }}>Inicio: {formatearFecha(subtarea.fecha_inicio)} · Fin: {formatearFecha(subtarea.fecha_fin)}</div>
                                                        : <div>{subtarea.motivo_standby && <span style={{ color: "#92400e" }}>Motivo de pausa: {subtarea.motivo_standby}</span>}</div>}

                                                    {subtarea.estado === "SOLUCIONADO" && subtarea.tiempo_tomado_formateado && <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>Tomado: {subtarea.tiempo_tomado_formateado} ({subtarea.tiempo_tomado_horas}h)</div>}
                                                </td>
                                                <td data-label="Asignado">{subtarea.asignado_nombre}</td>
                                                <td data-label="Cambiar Estado">
                                                    {esMiSubtarea && onCambiarEstadoSubtarea ? (
                                                        subtarea.estado === "SOLUCIONADO" ? (
                                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#000000", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "1px solid #86efac" }}>✓ Solucionado</span>
                                                        ) : subtarea.estado === "STAND_BY" ? (
                                                            <button
                                                                onClick={() => abrirReanudar(subtarea.id)}
                                                                style={{ background: "#f59e0b", color: "black", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                                                                title="Reanudar: continuar la cuenta regresiva o fijar nueva fecha de entrega"
                                                            >
                                                                REANUDAR
                                                            </button>
                                                        ) : (
                                                            <select
                                                                value={subtarea.estado}
                                                                onChange={(e) => {
                                                                    const nuevo = e.target.value;
                                                                    if (bloqueada && nuevo === "EN_DESARROLLO") {
                                                                        alert(`Bloqueada por: ${bloqueadorasPendientes.map(b => b.descripcion).join(", ")} - debe solucionarse primero`);
                                                                        return;
                                                                    }
                                                                    if (nuevo === "SOLUCIONADO") {
                                                                        const ok = confirm("¿Terminar subtarea? Se bloqueará en Solucionado.");
                                                                        if (!ok) return;
                                                                    }
                                                                    if (nuevo === "STAND_BY") {
                                                                        const motivo = prompt("Motivo de pausa (STAND_BY) obligatorio:");
                                                                        if (!motivo || !motivo.trim()) return;
                                                                        onCambiarEstadoSubtarea(tarea.id, subtarea.id, nuevo, motivo.trim());
                                                                    } else {
                                                                        onCambiarEstadoSubtarea(tarea.id, subtarea.id, nuevo);
                                                                    }
                                                                }}
                                                                className={styles.estadoSelect}
                                                                disabled={bloqueada && subtarea.estado === "EN_ESPERA"}
                                                                title={bloqueadaTooltip || "Cambiar estado"}
                                                            >
                                                                <option value="EN_ESPERA">En espera</option>
                                                                <option value="EN_DESARROLLO">En desarrollo</option>
                                                                <option value="STAND_BY">Stand-by</option>
                                                                <option value="SOLUCIONADO">Solucionado</option>
                                                            </select>
                                                        )
                                                    ) : puedeEmpezar ? (
                                                        <button
                                                            onClick={() => onEmpezarTarea!(tarea.id, subtarea.id)}
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
                                                            onClick={() => onCompletarSubtarea!(tarea.id, subtarea.id)}
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
                                                            {completandoId === subtarea.id ? "Guardando…" : "Marcar como completado"}
                                                        </button>
                                                    ) : subtarea.estado === "SOLUCIONADO" ? (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#000000", padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "1px solid #86efac" }}>✓ Solucionado</span>
                                                    ) : subtarea.estado === "STAND_BY" ? (
                                                        <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>Pausada</span>
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

                    {tarea.estado !== "SOLUCIONADO" ? (
                        <>
                            {subtareasProgreso.length > 1 && tarea.puedo_operar && (
                                <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fafafa" }}>
                                    <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Crear dependencia</h4>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                        <select value={depBloqueada} onChange={e => { const v = e.target.value ? Number(e.target.value) : ""; setDepBloqueada(v); if (v !== "" && v === depBloqueadora) setDepBloqueadora(""); }} className={styles.inputField} style={{ minWidth: 160 }}>
                                            <option value="">-- subtarea --</option>
                                            {subtareasProgreso.filter(s => s.id !== depBloqueadora).map(s => <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>)}
                                        </select>
                                        <span style={{ paddingBottom: 8 }}>depende de</span>
                                        <select value={depBloqueadora} onChange={e => { const v = e.target.value ? Number(e.target.value) : ""; setDepBloqueadora(v); if (v !== "" && v === depBloqueada) setDepBloqueada(""); }} className={styles.inputField} style={{ minWidth: 160 }}>
                                            <option value="">-- subtarea --</option>
                                            {subtareasProgreso.filter(s => s.id !== depBloqueada).map(s => <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>)}
                                        </select>
                                        <button onClick={agregarDependencia} className={`${styles.btn} ${styles.btnYes}`} style={{ fontSize: 12 }}>Agregar</button>
                                    </div>
                                    {depMsg && <p style={{ fontSize: 12, color: depMsg.includes("creada") ? "#166534" : "#991b1b", margin: "8px 0 0" }}>{depMsg}</p>}
                                </div>
                            )}
                        </>

                    ) : (
                        <div></div>
                    )}
                </>
            )}

            {tab === "historial" && (
                <div>
                    {/* Aquí moveremos Historial */}
                </div>
            )}

            {tab === "asignaciones" && (
                <div>
                    {/* Aquí moveremos Asignaciones */}
                </div>
            )}
        </div>
    );
}