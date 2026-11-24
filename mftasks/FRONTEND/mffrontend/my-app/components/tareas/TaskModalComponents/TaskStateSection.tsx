"use client";

import { Task } from "@/lib/types";
import TaskStatusBadge from "../TaskStatusBadge";

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
                                        <th>Subtarea</th>
                                        <th>Estado</th>
                                        <th>Peso</th>
                                        <th>Asignado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tarea.subtareas.map((s) => (
                                        <tr
                                            key={s.id}
                                            className={
                                                s.estado === "SOLUCIONADO"
                                                    ? styles.estadoSolucionado
                                                    : s.estado === "EN_DESARROLLO"
                                                        ? styles.estadoEnDesarrollo
                                                        : s.estado === "STAND_BY"
                                                            ? styles.estadoEnStandBy
                                                            : styles.estadoEnEspera
                                            }
                                            title={s.motivo_standby || ""}
                                        >
                                            <td data-label="Subtarea">{s.descripcion}</td>
                                            <td data-label="Estado"><TaskStatusBadge estado={s.estado} compact /></td>
                                            <td data-label="Peso">{s.peso}</td>
                                            <td data-label="Asignado">{s.asignado_nombre}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tarea.estado !== "SOLUCIONADO" ? (
                        <>
                            {subtareasProgreso.length > 1 && tarea.puedo_operar && (
                                <div style={{ marginTop: 12, border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, background: "var(--color-surface)" }}>
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
                                    {depMsg && <p style={{ fontSize: 12, color: depMsg.includes("creada") ? "var(--color-done)" : "var(--color-danger)", margin: "8px 0 0" }}>{depMsg}</p>}
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