"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
    fetchSugerenciasAsignacion,
    reabrirSubtarea as apiReabrirSubtarea,
    type SugerenciaAsignacion,
} from "@/lib/services/tareasService";
import { EquipoInfo, EquipoMiembroDetallado, Subtarea, Task } from "@/lib/types";
import IconButton from "@/components/ui/IconButton";
import RefreshButton from "@/components/ui/RefreshButton";
import ReabrirSubtareaDialog from "./ReabrirSubtareaDialog";
import styles from "./TaskModalDesarrollo.module.css";

type Props = {
    tarea: Task;
    puedeOperar: boolean;
    onReasignarSubtarea?: (tareaId: number, subtareaId: number, nuevoAsignado: number) => Promise<void>;
    onInactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
    onReactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
    onReabrirSubtarea?: (tareaId: number, subtareaId: number, motivo: string) => Promise<void>;
    onTareaMutated?: () => void | Promise<void>;
};

export default function AssignmentPanel({
    tarea,
    puedeOperar,
    onReasignarSubtarea,
    onInactivarSubtarea,
    onReactivarSubtarea,
    onReabrirSubtarea,
    onTareaMutated,
}: Props) {
    const [miembros, setMiembros] = useState<EquipoMiembroDetallado[]>([]);
    const [liderInfo, setLiderInfo] = useState<{ id: number; nombres: string; apellidos: string } | null>(null);
    const [miembrosLoading, setMiembrosLoading] = useState(false);
    const [miembrosError, setMiembrosError] = useState<string | null>(null);
    const [draftAsignado, setDraftAsignado] = useState<Record<number, number | "">>({});
    const [guardandoAsignaciones, setGuardandoAsignaciones] = useState(false);
    const [inactivandoId, setInactivandoId] = useState<number | null>(null);
    const [asigMsg, setAsigMsg] = useState<string | null>(null);
    const [asigErr, setAsigErr] = useState<string | null>(null);
    const [sugerencias, setSugerencias] = useState<Record<number, SugerenciaAsignacion>>({});
    const [sugiriendo, setSugiriendo] = useState(false);
    const [reabrirTarget, setReabrirTarget] = useState<Subtarea | null>(null);

    const cargarMiembros = async () => {
        setMiembrosLoading(true);
        setMiembrosError(null);
        try {
            const data = await apiFetch<EquipoInfo>(`/api/usuarios/equipos/${tarea.equipo}/`);
            setMiembros(data.miembros ?? []);
            if (data.lider) {
                setLiderInfo({ id: data.lider.id, nombres: data.lider.nombres, apellidos: data.lider.apellidos });
            }
        } catch (e) {
            setMiembrosError((e as Error).message);
        } finally {
            setMiembrosLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void cargarMiembros();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tarea.equipo]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftAsignado({});
        setSugerencias({});
        setAsigMsg(null);
        setAsigErr(null);
    }, [tarea.id]);

    {/*const opcionesAsignables = useMemo(() => {
        const map = new Map<number, string>();
        if (liderInfo) map.set(liderInfo.id, `${liderInfo.nombres} ${liderInfo.apellidos} (Líder)`);
        miembros.forEach((m) => {
            if (m.estado === "ACTIVO") {
                map.set(m.usuario.id, `${m.usuario.nombres} ${m.usuario.apellidos}`);
            }
        });
        return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
    }, [miembros, liderInfo]);*/}

    const opcionesAsignables = useMemo(() => {
        const map = new Map<number, string>();

        if (
            liderInfo &&
            miembros.some(
                (m) =>
                    m.usuario.id === liderInfo.id &&
                    m.estado === "ACTIVO" &&
                    m.disponibilidad?.estado === "DISPONIBLE"
            )
        ) {
            map.set(
                liderInfo.id,
                `${liderInfo.nombres} ${liderInfo.apellidos} (Líder)`
            );
        }

        miembros.forEach((m) => {
            if (
                m.estado === "ACTIVO" &&
                m.disponibilidad?.estado === "DISPONIBLE"
            ) {
                map.set(
                    m.usuario.id,
                    `${m.usuario.nombres} ${m.usuario.apellidos}`
                );
            }
        });

        return Array.from(map.entries()).map(([id, nombre]) => ({
            id,
            nombre,
        }));
    }, [miembros, liderInfo]);

    const hayCambiosAsignacion = tarea.subtareas.some((s) => {
        const v = draftAsignado[s.id];
        return typeof v === "number" && v !== s.asignado;
    });

    const guardarAsignaciones = async () => {
        const cambios: { subtareaId: number; nuevo: number }[] = [];
        for (const s of tarea.subtareas) {
            const v = draftAsignado[s.id];
            if (typeof v === "number" && v !== s.asignado) {
                cambios.push({ subtareaId: s.id, nuevo: v });
            }
        }
        if (cambios.length === 0) {
            setAsigErr(null);
            setAsigMsg("No hay cambios por guardar");
            return;
        }
        setAsigErr(null);
        setAsigMsg(null);
        setGuardandoAsignaciones(true);
        const guardadas = new Set<number>();
        const fallos: string[] = [];
        for (const c of cambios) {
            try {
                if (onReasignarSubtarea) {
                    await onReasignarSubtarea(tarea.id, c.subtareaId, c.nuevo);
                } else {
                    await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${c.subtareaId}/reasignar/`, {
                        method: "POST",
                        body: JSON.stringify({ nuevo_asignado: c.nuevo }),
                    });
                }
                guardadas.add(c.subtareaId);
            } catch (e) {
                fallos.push(`#${c.subtareaId}: ${(e as Error).message}`);
            }
        }
        if (guardadas.size > 0) {
            setDraftAsignado((prev) => {
                const n = { ...prev };
                guardadas.forEach((id) => { n[id] = ""; });
                return n;
            });
            setAsigMsg(`${guardadas.size} subtarea(s) reasignada(s)`);
        }
        if (fallos.length > 0) setAsigErr(fallos.join(" | "));
        try {
            await onTareaMutated?.();
        } finally {
            setGuardandoAsignaciones(false);
        }
    };

    const handleInactivar = async (subtareaId: number) => {
        const ok = confirm("¿Inactivar subtarea? No contará en el progreso y se eliminarán sus dependencias. Se puede reactivar.");
        if (!ok) return;
        setAsigErr(null);
        setAsigMsg(null);
        setInactivandoId(subtareaId);
        try {
            if (onInactivarSubtarea) {
                await onInactivarSubtarea(tarea.id, subtareaId);
            } else {
                await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${subtareaId}/inactivar/`, { method: "POST" });
            }
            setAsigMsg(`Subtarea #${subtareaId} inactivada`);
            await onTareaMutated?.();
        } catch (e) {
            setAsigErr((e as Error).message);
        } finally {
            setInactivandoId(null);
        }
    };

    const handleReactivar = async (subtareaId: number) => {
        setAsigErr(null);
        setAsigMsg(null);
        setInactivandoId(subtareaId);
        try {
            if (onReactivarSubtarea) {
                await onReactivarSubtarea(tarea.id, subtareaId);
            } else {
                await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${subtareaId}/reactivar/`, { method: "POST" });
            }
            setAsigMsg(`Subtarea #${subtareaId} reactivada`);
            await onTareaMutated?.();
        } catch (e) {
            setAsigErr((e as Error).message);
        } finally {
            setInactivandoId(null);
        }
    };

    const handleSugerir = async () => {
        setAsigErr(null);
        setAsigMsg(null);
        setSugiriendo(true);
        try {
            const data = await fetchSugerenciasAsignacion(tarea.id);
            if (data.length === 0) {
                setAsigMsg("No hay miembros disponibles para sugerir.");
                return;
            }
            const mapa: Record<number, SugerenciaAsignacion> = {};
            const nuevos: Record<number, number | ""> = {};
            for (const sugerencia of data) {
                mapa[sugerencia.subtarea_id] = sugerencia;
                nuevos[sugerencia.subtarea_id] = sugerencia.sugerido;
            }
            setSugerencias(mapa);
            setDraftAsignado((prev) => ({ ...prev, ...nuevos }));
            setAsigMsg(
                `${data.length} sugerencia(s) cargada(s) según disponibilidad y carga. Revisa y guarda.`
            );
        } catch (e) {
            setAsigErr((e as Error).message);
        } finally {
            setSugiriendo(false);
        }
    };

    const handleReabrir = async (motivo: string) => {
        if (!reabrirTarget) return;
        setAsigErr(null);
        setAsigMsg(null);
        if (onReabrirSubtarea) {
            await onReabrirSubtarea(tarea.id, reabrirTarget.id, motivo);
        } else {
            await apiReabrirSubtarea(tarea.id, reabrirTarget.id, motivo);
        }
        setAsigMsg(`Subtarea #${reabrirTarget.id} reabierta`);
        await onTareaMutated?.();
    };

    return (
        <div>
            <div className={styles.assignmentHeader}>
                <div>
                    <h3 className={styles.sectionTitle}>Asignaciones</h3>
                    <p className={styles.sectionHint}>Cambia el asignado, sugiere por carga o reabre subtareas solucionadas.</p>
                </div>
                <div className={styles.assignmentActions}>
                    <button
                        type="button"
                        onClick={() => void handleSugerir()}
                        disabled={!puedeOperar || sugiriendo || tarea.subtareas.length === 0}
                        title="Sugerir responsables según disponibilidad y carga"
                        className={styles.btnSecondary}
                        style={{ padding: "7px 12px", fontSize: 12 }}
                    >
                        {sugiriendo ? "Sugiriendo…" : "Sugerir por carga"}
                    </button>
                    <RefreshButton onClick={cargarMiembros} loading={miembrosLoading} variant="outline" title="Recargar equipo" />
                    <button
                        type="button"
                        onClick={guardarAsignaciones}
                        disabled={!hayCambiosAsignacion || guardandoAsignaciones || !puedeOperar}
                        title={hayCambiosAsignacion ? "Guardar todas las reasignaciones seleccionadas" : "No hay cambios por guardar"}
                        className={styles.saveButton}
                    >
                        {guardandoAsignaciones ? "Guardando…" : "Guardar cambios"}
                    </button>
                </div>
            </div>

            {miembrosError && <p className={styles.errorNotice}>{miembrosError}</p>}
            {asigErr && <p className={styles.errorNotice}>{asigErr}</p>}
            {asigMsg && <p className={styles.successNotice}>{asigMsg}</p>}

            {tarea.subtareas.length === 0 ? (
                <p className={styles.sinSubtareas}>Sin subtareas para asignar.</p>
            ) : (
                <div className={styles.subtareasContainer} style={{ maxHeight: 360 }}>
                    <table className={styles.subtareasTable}>
                        <thead>
                            <tr>
                                <th>Subtarea</th>
                                <th>Asignado actual</th>
                                <th>Nuevo asignado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tarea.subtareas.map((subtarea) => {
                                const inactiva = subtarea.activo === false;
                                const esSolucionada = subtarea.estado === "SOLUCIONADO";
                                return (
                                    <tr key={subtarea.id} style={inactiva ? { opacity: 0.7, background: "var(--color-surface)" } : undefined}>
                                        <td data-label="Subtarea">
                                            <div className={styles.subtaskTitle}>
                                                {subtarea.codigo && <span className={styles.subtaskCode}>{subtarea.codigo}</span>}
                                                <span>{subtarea.descripcion}</span>
                                                {inactiva && <span className={styles.blockedBadge}>Inactiva</span>}
                                                {esSolucionada && <span className={styles.doneText}>Solucionada</span>}
                                            </div>
                                            <div className={styles.subtaskMeta}>Peso {subtarea.peso} · Estado {subtarea.estado}</div>
                                        </td>
                                        <td data-label="Asignado actual">{subtarea.asignado_nombre}</td>
                                        <td data-label="Nuevo asignado">
                                            {inactiva || esSolucionada ? (
                                                <span className={styles.mutedText}>{inactiva ? "Reactivar para reasignar" : "No reasignable"}</span>
                                            ) : opcionesAsignables.length === 0 ? (
                                                <span className={styles.mutedText}>{miembrosLoading ? "Cargando…" : "Sin miembros activos"}</span>
                                            ) : (
                                                <>
                                                <select
                                                    value={draftAsignado[subtarea.id] ?? ""}
                                                    onChange={(e) => setDraftAsignado((prev) => ({ ...prev, [subtarea.id]: e.target.value ? Number(e.target.value) : "" }))}
                                                    className={styles.estadoSelect}
                                                    aria-label={`Nuevo asignado para ${subtarea.descripcion}`}
                                                >
                                                    <option value="">— seleccionar —</option>
                                                    {opcionesAsignables.map((o) => (
                                                        <option key={o.id} value={o.id}>{o.nombre}</option>
                                                    ))}
                                                </select>
                                                    {sugerencias[subtarea.id] && (
                                                        <div className={styles.subtaskMeta} style={{ marginTop: 4 }}>
                                                            Sugerido: {sugerencias[subtarea.id].sugerido_nombre} · carga {sugerencias[subtarea.id].carga_actual}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td data-label="Acciones">
                                            <div className={styles.assignmentRowActions}>
                                                {esSolucionada && !inactiva ? (
                                                    <IconButton
                                                        icon="power"
                                                        variant="success"
                                                        onClick={() => setReabrirTarget(subtarea)}
                                                        disabled={inactivandoId === subtarea.id || !puedeOperar || tarea.estado === "RECHAZADO" || tarea.estado === "CANCELADO"}
                                                        title="Reabrir subtarea solucionada"
                                                    />
                                                ) : !inactiva ? (
                                                    <IconButton
                                                        icon="ban"
                                                        variant="danger"
                                                        onClick={() => void handleInactivar(subtarea.id)}
                                                        disabled={inactivandoId === subtarea.id || !puedeOperar}
                                                        title="Inactivar subtarea"
                                                    />
                                                ) : (
                                                    <IconButton
                                                        icon="power"
                                                        variant="success"
                                                        onClick={() => void handleReactivar(subtarea.id)}
                                                        disabled={inactivandoId === subtarea.id || !puedeOperar}
                                                        title="Reactivar subtarea"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {reabrirTarget && (
                <ReabrirSubtareaDialog
                    subtarea={reabrirTarget}
                    onClose={() => setReabrirTarget(null)}
                    onConfirmar={handleReabrir}
                />
            )}
        </div>
    );
}
