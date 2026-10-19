"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import TaskStatusBadge from "./TaskStatusBadge";
import type { Subtarea, Task } from "@/lib/types";
import styles from "./TareaDetalle.module.css";

export const COLUMNAS_TABLERO = [
    { key: "EN_ESPERA", label: "En espera" },
    { key: "EN_DESARROLLO", label: "En desarrollo" },
    { key: "SOLUCIONADO", label: "Solucionado" },
] as const;

type Destino = (typeof COLUMNAS_TABLERO)[number]["key"];

type Props = {
    subtarea: Subtarea;
    tarea: Task;
    puedeMover: (subtarea: Subtarea) => boolean;
    procesando?: boolean;
    onMove: (subtarea: Subtarea, destino: string) => void;
};

function destinosPermitidos(estado: string): Destino[] {
    if (estado === "EN_ESPERA") return ["EN_DESARROLLO"];
    if (estado === "EN_DESARROLLO") return ["SOLUCIONADO"];
    return [];
}

export default function SubtaskCard({ subtarea, tarea, puedeMover, procesando, onMove }: Props) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuWrapRef = useRef<HTMLDivElement>(null);

    const autorizado = puedeMover(subtarea);
    const pausada = subtarea.estado === "STAND_BY";
    const solucionada = subtarea.estado === "SOLUCIONADO";
    const arrastrable = autorizado && !pausada && !solucionada;
    const destinos = destinosPermitidos(subtarea.estado);

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `sub-${subtarea.id}`,
        data: { subtarea },
        disabled: !arrastrable || !!procesando,
    });

    useEffect(() => {
        if (!menuOpen) return;

        const cerrarSiFuera = (event: MouseEvent) => {
            if (!menuWrapRef.current?.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };

        document.addEventListener("mousedown", cerrarSiFuera);
        window.addEventListener("keydown", cerrarConEscape);
        return () => {
            document.removeEventListener("mousedown", cerrarSiFuera);
            window.removeEventListener("keydown", cerrarConEscape);
        };
    }, [menuOpen]);

    const pendientes = (subtarea.bloqueada_por ?? []).filter((b) => b.estado !== "SOLUCIONADO");
    const bloqueada = pendientes.length > 0;
    const bloqueaA = tarea.subtareas.filter((s) =>
        (s.bloqueada_por ?? []).some((b) => b.id === subtarea.id)
    );

    const ejecutar = (destino: string) => {
        setMenuOpen(false);
        onMove(subtarea, destino);
    };

    return (
        <article
            ref={setNodeRef}
            className={[
                styles.subtaskCard,
                isDragging ? styles.subtaskCardDragging : "",
                procesando ? styles.subtaskCardPending : "",
            ].filter(Boolean).join(" ")}
            aria-busy={procesando || undefined}
        >
            <div className={styles.subtaskCardTop}>
                <span className={styles.subtaskCode}>{subtarea.codigo ?? `#${subtarea.id}`}</span>

                <div className={styles.subtaskCardActions}>
                    {autorizado && !solucionada && (
                        <div className={styles.cardMenuWrap} ref={menuWrapRef}>
                            <button
                                type="button"
                                className={styles.menuButton}
                                aria-label={`Acciones de ${subtarea.descripcion}`}
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen((v) => !v)}
                                disabled={!!procesando}
                            >
                                ⋮
                            </button>

                            {menuOpen && (
                                <div className={styles.cardMenu} role="menu">
                                    {pausada ? (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className={styles.menuItem}
                                            onClick={() => ejecutar("EN_DESARROLLO")}
                                        >
                                            Reanudar
                                        </button>
                                    ) : (
                                        <>
                                            {destinos.map((destino) => (
                                                <button
                                                    key={destino}
                                                    type="button"
                                                    role="menuitem"
                                                    className={`${styles.menuItem} ${styles.menuMoveItem}`}
                                                    onClick={() => ejecutar(destino)}
                                                >
                                                    Mover a {COLUMNAS_TABLERO.find((c) => c.key === destino)?.label}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className={styles.menuItem}
                                                onClick={() => ejecutar("STAND_BY")}
                                            >
                                                Pausar (Stand-by)
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/*<button
                        type="button"
                        className={styles.dragHandle}
                        {...attributes}
                        {...listeners}
                        disabled={!arrastrable || !!procesando}
                        aria-label={`Mover subtarea ${subtarea.descripcion}`}
                        title={arrastrable ? "Arrastrar para cambiar de estado" : "No puedes mover esta subtarea"}
                    >
                        ⠿
                    </button>*/}
                    <button
                        type="button"
                        className={styles.dragHandle}
                        {...attributes}
                        {...listeners}
                        disabled={!arrastrable || !!procesando}
                        aria-label="Mover subtarea"
                        title={arrastrable ? "Arrastrar para cambiar de estado" : "No puedes mover esta subtarea"}
                    >
                        ⠿
                    </button>
                </div>
            </div>

            <p className={styles.subtaskDescription}>{subtarea.descripcion}</p>

            <div className={styles.subtaskStatusRow}>
                <TaskStatusBadge estado={subtarea.estado} compact />
                {bloqueada && <span className={styles.blockedBadge}>Bloqueada</span>}
            </div>

            <div className={styles.subtaskAssignee}>
                <span className={styles.subtaskLabel}>Asignado a: </span>
                <strong>{subtarea.asignado_nombre || "Sin asignar"}</strong>
            </div>

            {bloqueada && (
                <div className={styles.blockReason}>
                    <strong>Bloqueada:</strong> primero debes solucionar {pendientes.map((b) => b.descripcion).join(", ")}.
                </div>
            )}

            {(subtarea.bloqueada_por?.length ?? 0 ) > 0 && (
                !solucionada && (
                 <div className={styles.dependencyLine}>
                    Depende de: {subtarea.bloqueada_por!.map((b) => `#${b.id} ${b.descripcion}`).join(", ")}
                </div>   
                )
                
            )}

            {pausada && subtarea.motivo_standby && (
                <div className={styles.standbyReason}>Pausa: {subtarea.motivo_standby}</div>
            )}

            {procesando && <div className={styles.cardPendingText}>Actualizando…</div>}

            {!pausada && !solucionada && destinos.length > 0 && (
                <div className={styles.subtaskCardFooter}>
                    <label className={styles.mobileMove}>
                        <span className={styles.srOnly}>Mover subtarea a otro estado</span>
                        <select
                            value=""
                            disabled={!autorizado || !!procesando}
                            className={styles.moveSelect}
                            onChange={(e) => {
                                const destino = e.target.value;
                                e.currentTarget.value = "";
                                if (destino) onMove(subtarea, destino);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <option value="">Mover a…</option>
                            {destinos.map((destino) => (
                                <option key={destino} value={destino}>
                                    {COLUMNAS_TABLERO.find((c) => c.key === destino)?.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}
        </article>
    );
}
