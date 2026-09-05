"use client";

import { useEffect, useState } from "react";
import styles from "./TaskModalDesarrollo.module.css";
import { apiFetch } from "@/lib/api";
import { EquipoInfo, EquipoMiembro, EquipoMiembroDetallado, Task } from "@/lib/types";

interface SubtareaForm {
    descripcion: string;
    asignado: number | "";
    peso: number;
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
            incluye_sabado: boolean;
            subtareas: { descripcion: string; asignado: number; peso: number }[];
        }
    ) => void;
}

export default function TaskIniciarModal({
    tarea,
    accionando,
    onClose,
    onSubmit,
}: TaskIniciarModalProps) {
    const [miembros, setMiembros] = useState<EquipoMiembro[]>([]);
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaEntrega, setFechaEntrega] = useState("");
    const [incluyeSabado, setIncluyeSabado] = useState(false);
    const [subtareas, setSubtareas] = useState<SubtareaForm[]>([
        { descripcion: "", asignado: "", peso: 1 },
    ]);
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
        setSubtareas((prev) => [
            ...prev,
            { descripcion: "", asignado: "", peso: 1 },
        ]);
    };

    const quitar = (index: number) => {
        setSubtareas((prev) => prev.filter((_, i) => i !== index));
    };

    const confirmar = () => {
        if (!fechaInicio || !fechaEntrega) {
            setError("Debe indicar la fecha de inicio y de entrega aproximada.");
            return;
        }

        const validas = subtareas.filter(
            (s) => s.descripcion.trim() && s.asignado !== ""
        );

        if (validas.length === 0) {
            setError("Debe asignar al menos una subtarea completa.");
            return;
        }

        setError(null);

        onSubmit(tarea, {
            fecha_inicio: fechaInicio,
            fecha_entrega_aproximada: fechaEntrega,
            incluye_sabado: incluyeSabado,
            subtareas: validas.map((s) => ({
                descripcion: s.descripcion.trim(),
                asignado: Number(s.asignado),
                peso: Number(s.peso) || 1,
            })),
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
                        <h2>Iniciar tarea #{tarea.id}</h2>
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
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className={styles.inputField}
                            />
                        </label>

                        <label>
                            Fecha de entrega aproximada
                            <input
                                type="datetime-local"
                                value={fechaEntrega}
                                onChange={(e) => setFechaEntrega(e.target.value)}
                                className={styles.inputField}
                            />
                        </label>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" checked={incluyeSabado} onChange={(e) => setIncluyeSabado(e.target.checked)} />
                        Incluir sábados laborables (9:00-13:00) — solo líderes/sublíderes deben activar esta opción
                    </label>

                    <div>
                        <h3 style={{ marginBottom: "8px" }}>Subtareas</h3>

                        {subtareas.map((subtarea, index) => (
                            <div
                                key={index}
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
                                    onChange={(e) =>
                                        actualizar(index, "peso", Number(e.target.value))
                                    }
                                    className={styles.inputField}
                                />

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

