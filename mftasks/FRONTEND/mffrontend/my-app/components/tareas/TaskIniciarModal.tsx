"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TaskModalDesarrollo.module.css";
import { apiFetch } from "@/lib/api";
import { EquipoInfo, EquipoMiembro, EquipoMiembroDetallado, Task } from "@/lib/types";

interface SubtareaForm {
    key: string;
    descripcion: string;
    asignado: number | "";
    peso: number;
    dependeDe: string;
}

interface DependenciaPayload {
    bloqueada: number;
    bloqueadora: number;
}

interface TaskIniciarModalProps {
    tarea: Task;
    accionando?: boolean;
    onClose: () => void;
    onSubmit: (
        tarea: Task,
        payload: {
            fecha_inicio: string;
            fecha_entrega_aproximada: string;
            subtareas: { descripcion: string; asignado: number; peso: number }[];
            dependencias: DependenciaPayload[];
        }
    ) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

const aDatetimeLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

let contadorFila = 1;

const crearFila = (): SubtareaForm => ({
    key: `s${contadorFila++}`,
    descripcion: "",
    asignado: "",
    peso: 1,
    dependeDe: "",
});

export default function TaskIniciarModal({
    tarea,
    accionando,
    onClose,
    onSubmit,
}: TaskIniciarModalProps) {
    const [miembros, setMiembros] = useState<EquipoMiembro[]>([]);
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaEntrega, setFechaEntrega] = useState("");
    const [subtareas, setSubtareas] = useState<SubtareaForm[]>(() => [crearFila()]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<EquipoInfo>(`/api/usuarios/equipos/${tarea.equipo}/`)
            .then((equipo) => {
                // miembros viene como EquipoMiembroDetallado[]; normalizar a EquipoMiembro (user id)
                const miembrosRaw = equipo.miembros as unknown as (EquipoMiembro | EquipoMiembroDetallado)[];
                const normalizados: EquipoMiembro[] = miembrosRaw
                    .map((m) => {
                        // si es detallado, usar id_usuario; filtrar inactivos/indisponibles no asignables
                        const det = m as EquipoMiembroDetallado;
                        if ("id_usuario" in det) {
                            if (det.estado && det.estado !== "ACTIVO") return null;
                            return { id: det.id_usuario, email: det.email, nombres: det.nombres, apellidos: det.apellidos, cargo: det.cargo } as EquipoMiembro;
                        }
                        return m as EquipoMiembro;
                    })
                    .filter(Boolean) as EquipoMiembro[];
                const todos: EquipoMiembro[] = [...normalizados];
                if (equipo.lider && !todos.some((m) => m.id === equipo.lider!.id)) {
                    todos.unshift(equipo.lider);
                }
                setMiembros(todos);
            })
            .catch((e: Error) => setError(e.message));
    }, [tarea.equipo]);

    const limitesInicio = useMemo(() => {
        const hoy = new Date();
        const min = new Date(hoy);
        min.setHours(0, 0, 0, 0);
        const max = new Date(hoy);
        max.setDate(max.getDate() + 5);
        max.setHours(23, 59, 0, 0);
        return { min: aDatetimeLocal(min), max: aDatetimeLocal(max) };
    }, []);

    const minEntrega = useMemo(() => {
        if (!fechaInicio) return undefined;
        const d = new Date(fechaInicio);
        if (isNaN(d.getTime())) return undefined;
        d.setMinutes(d.getMinutes() + 1);
        return aDatetimeLocal(d);
    }, [fechaInicio]);

    const actualizar = (
        index: number,
        campo: keyof SubtareaForm,
        valor: string | number
    ) => {
        setSubtareas((prev) =>
            prev.map((s, i) => (i === index ? { ...s, [campo]: valor } : s))
        );
    };

    const agregar = () => {
        setSubtareas((prev) => [...prev, crearFila()]);
    };

    const quitar = (index: number) => {
        const key = subtareas[index]?.key;
        setSubtareas((prev) =>
            prev
                .filter((_, i) => i !== index)
                .map((s) => (s.dependeDe === key ? { ...s, dependeDe: "" } : s))
        );
    };

    const confirmar = () => {
        if (!fechaInicio || !fechaEntrega) {
            setError("Debe indicar la fecha de inicio y de entrega aproximada.");
            return;
        }

        if (fechaInicio < limitesInicio.min || fechaInicio > limitesInicio.max) {
            setError("La fecha de inicio debe estar entre hoy y 5 días después.");
            return;
        }

        if (fechaEntrega <= fechaInicio) {
            setError("La fecha de entrega aproximada debe ser posterior a la fecha de inicio.");
            return;
        }

        const validas = subtareas.filter(
            (s) => s.descripcion.trim() && s.asignado !== ""
        );

        if (validas.length === 0) {
            setError("Debe asignar al menos una subtarea completa.");
            return;
        }

        const clavesValidas = new Set(validas.map((s) => s.key));

        // Evitar ciclos antes de enviar (el backend también lo valida)
        const depMap = new Map<string, string>();
        for (const s of validas) {
            if (s.dependeDe && clavesValidas.has(s.dependeDe)) {
                depMap.set(s.key, s.dependeDe);
            }
        }
        const enCamino = new Set<string>();
        const visitados = new Set<string>();
        const hayCiclo = (key: string): boolean => {
            if (enCamino.has(key)) return true;
            if (visitados.has(key)) return false;
            enCamino.add(key);
            const siguiente = depMap.get(key);
            if (siguiente && hayCiclo(siguiente)) return true;
            enCamino.delete(key);
            visitados.add(key);
            return false;
        };
        for (const s of validas) {
            if (hayCiclo(s.key)) {
                setError("Las dependencias forman un ciclo.");
                return;
            }
        }

        const dependencias: DependenciaPayload[] = validas
            .filter((s) => s.dependeDe && clavesValidas.has(s.dependeDe))
            .map((s) => ({
                bloqueada: validas.findIndex((v) => v.key === s.key),
                bloqueadora: validas.findIndex((v) => v.key === s.dependeDe),
            }));

        setError(null);

        onSubmit(tarea, {
            fecha_inicio: fechaInicio,
            fecha_entrega_aproximada: fechaEntrega,
            subtareas: validas.map((s) => ({
                descripcion: s.descripcion.trim(),
                asignado: Number(s.asignado),
                peso: Number(s.peso) || 1,
            })),
            dependencias,
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <div>
                        <h2>{tarea.ticket ?? `Iniciar tarea #${tarea.id}`}</h2>
                        <p>{tarea.asunto}</p>
                    </div>

                    <button className={styles.close} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.iniciarBody}>
                    <div className={styles.fechasRow}>
                        <label>
                            Fecha de inicio
                            <input
                                type="datetime-local"
                                value={fechaInicio}
                                min={limitesInicio.min}
                                max={limitesInicio.max}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setFechaInicio(v);
                                    if (fechaEntrega && v && fechaEntrega <= v) {
                                        setFechaEntrega("");
                                    }
                                }}
                                className={styles.inputField}
                            />
                            <span style={{ fontSize: 11, color: "#6b7280" }}>
                                Entre hoy y {limitesInicio.max.slice(0, 10)}.
                            </span>
                        </label>

                        <label>
                            Fecha de entrega aproximada
                            <input
                                type="datetime-local"
                                value={fechaEntrega}
                                min={minEntrega}
                                onChange={(e) => setFechaEntrega(e.target.value)}
                                className={styles.inputField}
                            />
                            <span style={{ fontSize: 11, color: "#6b7280" }}>
                                Debe ser posterior a la fecha de inicio.
                            </span>
                        </label>
                    </div>

                    <div>
                        <h3 style={{ marginBottom: "8px" }}>Subtareas</h3>

                        <div className={styles.subtareaHeader}>
                            <span>Descripción</span>
                            <span>Asignado a</span>
                            <span>Peso</span>
                            <span>Depende de</span>
                            <span></span>
                        </div>

                        {subtareas.map((subtarea, index) => (
                            <div
                                key={subtarea.key}
                                className={styles.subtareaRow}
                            >
                                <input
                                    type="text"
                                    placeholder="Descripción de la subtarea"
                                    value={subtarea.descripcion}
                                    onChange={(e) =>
                                        actualizar(index, "descripcion", e.target.value)
                                    }
                                    className={styles.inputField}
                                />

                                <select
                                    value={subtarea.asignado}
                                    onChange={(e) =>
                                        actualizar(
                                            index,
                                            "asignado",
                                            e.target.value ? Number(e.target.value) : ""
                                        )
                                    }
                                    className={styles.inputField}
                                >
                                    <option value="">Asignar a…</option>
                                    {miembros.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.nombres} {m.apellidos}
                                        </option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    min={1}
                                    value={subtarea.peso}
                                    aria-label="Peso"
                                    placeholder="Peso"
                                    onChange={(e) =>
                                        actualizar(index, "peso", Number(e.target.value))
                                    }
                                    className={styles.inputField}
                                />

                                <select
                                    value={subtarea.dependeDe}
                                    aria-label="Depende de"
                                    onChange={(e) =>
                                        actualizar(index, "dependeDe", e.target.value)
                                    }
                                    className={styles.inputField}
                                    disabled={subtareas.length < 2}
                                    title="Subtarea que debe solucionarse antes"
                                >
                                    <option value="">— Depende de —</option>
                                    {subtareas
                                        .filter((s) => s.key !== subtarea.key)
                                        .map((s) => (
                                            <option key={s.key} value={s.key}>
                                                {s.descripcion.trim() ||
                                                    `Subtarea ${subtareas.findIndex((x) => x.key === s.key) + 1}`}
                                            </option>
                                        ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={() => quitar(index)}
                                    disabled={subtareas.length === 1}
                                    className={styles.inputField}
                                    style={{ cursor: "pointer" }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={agregar}
                            style={{
                                border: "1px dashed #999",
                                background: "transparent",
                                padding: "6px 14px",
                                borderRadius: "6px",
                                cursor: "pointer",
                            }}
                        >
                            + Agregar subtarea
                        </button>
                    </div>

                    {error && (
                        <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={onClose}
                    >
                        Cancelar
                    </button>

                    <button
                        className={`${styles.btn} ${styles.btnYes}`}
                        onClick={confirmar}
                        disabled={accionando}
                    >
                        {accionando ? "Iniciando…" : "Iniciar tarea"}
                    </button>
                </div>
            </div>
        </div>
    );
}
