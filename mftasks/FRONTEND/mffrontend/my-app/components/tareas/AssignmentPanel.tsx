"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { EquipoInfo, EquipoMiembroDetallado, Task } from "@/lib/types";
import IconButton from "@/components/ui/IconButton";
import RefreshButton from "@/components/ui/RefreshButton";
import styles from "./TaskModalDesarrollo.module.css";

type Props = {
    tarea: Task;
    puedeOperar: boolean;
    onReasignarSubtarea?: (tareaId: number, subtareaId: number, nuevoAsignado: number) => Promise<void>;
    onInactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
    onReactivarSubtarea?: (tareaId: number, subtareaId: number) => Promise<void>;
    onTareaMutated?: () => void | Promise<void>;
};

export default function AssignmentPanel({
    tarea,
    puedeOperar,
    onReasignarSubtarea,
    onInactivarSubtarea,
    onReactivarSubtarea,
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

    const [depBloqueada, setDepBloqueada] = useState<number | "">("");
    const [depBloqueadora, setDepBloqueadora] = useState<number | "">("");
    const [depMsg, setDepMsg] = useState<string | null>(null);

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
        setAsigMsg(null);
        setAsigErr(null);
        setDepMsg(null);
    }, [tarea.id]);

    const opcionesAsignables = useMemo(() => {
        const map = new Map<number, string>();
        if (liderInfo) map.set(liderInfo.id, `${liderInfo.nombres} ${liderInfo.apellidos} (Líder)`);
        miembros.forEach((m) => {
            if (m.estado === "ACTIVO") {
                map.set(m.usuario.id, `${m.usuario.nombres} ${m.usuario.apellidos}`);
            }
        });
        return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
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

    const agregarDependencia = async () => {
        if (depBloqueada === "" || depBloqueadora === "") {
            setDepMsg("Selecciona ambas subtareas");
            return;
        }
        if (depBloqueada === depBloqueadora) {
            setDepMsg("No puede depender de sí misma");
            return;
        }
        try {
            await apiFetch(`/api/tasks/tasks/${tarea.id}/subtareas/${depBloqueada}/dependencias/`, {
                method: "POST",
                body: JSON.stringify({ bloqueadora_id: depBloqueadora }),
            });
            setDepMsg("Dependencia creada.");
            setDepBloqueada("");
            setDepBloqueadora("");
            await onTareaMutated?.();
        } catch (e) {
            setDepMsg((e as Error).message);
        }
    };

    const subtareasActivas = tarea.subtareas.filter((s) => s.activo !== false);

    return (
        <div>
            <div className={styles.assignmentHeader}>
                <div>
                    <h3 className={styles.sectionTitle}>Asignaciones</h3>
                    <p className={styles.sectionHint}>Cambia el asignado, inactiva subtareas o crea dependencias entre ellas.</p>
                </div>
                <div className={styles.assignmentActions}>
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
                                            )}
                                        </td>
                                        <td data-label="Acciones">
                                            <div className={styles.assignmentRowActions}>
                                                {!inactiva ? (
                                                    <IconButton
                                                        icon="ban"
                                                        variant="danger"
                                                        onClick={() => void handleInactivar(subtarea.id)}
                                                        disabled={esSolucionada || inactivandoId === subtarea.id || !puedeOperar}
                                                        title={esSolucionada ? "No se puede inactivar solucionada" : "Inactivar subtarea"}
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

            {subtareasActivas.length > 1 && puedeOperar && (
                <div className={styles.dependencyEditor}>
                    <h4 className={styles.dependencyTitle}>Crear dependencia</h4>
                    <p className={styles.sectionHint}>Selecciona qué subtarea debe esperar a otra.</p>
                    <div className={styles.dependencyRow}>
                        <select
                            value={depBloqueada}
                            onChange={(e) => {
                                const v = e.target.value ? Number(e.target.value) : "";
                                setDepBloqueada(v);
                                if (v !== "" && v === depBloqueadora) setDepBloqueadora("");
                            }}
                            className={styles.selectField}
                            aria-label="Subtarea que depende de otra"
                        >
                            <option value="">— subtarea —</option>
                            {subtareasActivas.filter((s) => s.id !== depBloqueadora).map((s) => (
                                <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>
                            ))}
                        </select>
                        <span className={styles.dependencyLabel}>depende de</span>
                        <select
                            value={depBloqueadora}
                            onChange={(e) => {
                                const v = e.target.value ? Number(e.target.value) : "";
                                setDepBloqueadora(v);
                                if (v !== "" && v === depBloqueada) setDepBloqueada("");
                            }}
                            className={styles.selectField}
                            aria-label="Subtarea que debe solucionarse primero"
                        >
                            <option value="">— subtarea —</option>
                            {subtareasActivas.filter((s) => s.id !== depBloqueada).map((s) => (
                                <option key={s.id} value={s.id}>{s.id} - {s.descripcion.slice(0, 30)}</option>
                            ))}
                        </select>
                        <button type="button" onClick={() => void agregarDependencia()} className={styles.addDependencyButton}>
                            Agregar
                        </button>
                    </div>
                    {depMsg && (
                        <p className={depMsg.includes("creada") ? styles.successNotice : styles.errorNotice}>{depMsg}</p>
                    )}
                </div>
            )}
        </div>
    );
}
