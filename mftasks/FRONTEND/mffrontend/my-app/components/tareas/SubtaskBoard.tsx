"use client";

import { useMemo, useState } from "react";
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import SubtaskCard, { COLUMNAS_TABLERO } from "./SubtaskCard";
import type { Subtarea, Task } from "@/lib/types";
import styles from "./TareaDetalle.module.css";

const ACENTOS: Record<string, string> = {
    EN_ESPERA: styles.columnEspera,
    EN_DESARROLLO: styles.columnDesarrollo,
    SOLUCIONADO: styles.columnSolucionado,
};

function columnaDeSubtarea(subtarea: Subtarea): string {
    if (subtarea.estado === "STAND_BY") {
        return subtarea.fecha_inicio ? "EN_DESARROLLO" : "EN_ESPERA";
    }
    if (subtarea.estado === "SOLUCIONADO") return "SOLUCIONADO";
    if (subtarea.estado === "EN_DESARROLLO") return "EN_DESARROLLO";
    return "EN_ESPERA";
}

function Columna({
    estado,
    label,
    subtareas,
    tarea,
    puedeMover,
    procesandoId,
    onMove,
}: {
    estado: string;
    label: string;
    subtareas: Subtarea[];
    tarea: Task;
    puedeMover: (subtarea: Subtarea) => boolean;
    procesandoId: number | null;
    onMove: (subtarea: Subtarea, destino: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `col-${estado}` });

    return (
        <section
            ref={setNodeRef}
            className={[
                styles.boardColumn,
                ACENTOS[estado],
                isOver ? styles.boardColumnOver : "",
            ].filter(Boolean).join(" ")}
            aria-label={`${label}, ${subtareas.length} subtarea${subtareas.length === 1 ? "" : "s"}`}
        >
            <header className={styles.columnHeader}>
                <h3 className={styles.columnTitle}>{label}</h3>
                <span className={styles.columnCount}>{subtareas.length}</span>
            </header>

            <div className={styles.columnBody}>
                {subtareas.length === 0 ? (
                    <div className={styles.columnEmpty}>Sin subtareas</div>
                ) : (
                    subtareas.map((subtarea) => (
                        <SubtaskCard
                            key={subtarea.id}
                            subtarea={subtarea}
                            tarea={tarea}
                            puedeMover={puedeMover}
                            procesando={procesandoId === subtarea.id}
                            onMove={onMove}
                        />
                    ))
                )}
            </div>
        </section>
    );
}

type Props = {
    tarea: Task;
    puedeMover: (subtarea: Subtarea) => boolean;
    procesandoId?: number | null;
    onMove: (subtarea: Subtarea, destino: string) => void;
};

export default function SubtaskBoard({ tarea, puedeMover, procesandoId, onMove }: Props) {
    const [activa, setActiva] = useState<Subtarea | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
        useSensor(KeyboardSensor)
    );

    const columnas = useMemo(
        () =>
            COLUMNAS_TABLERO.map((estado) => ({
                ...estado,
                subtareas: tarea.subtareas
                    .filter((s) => s.activo !== false && columnaDeSubtarea(s) === estado.key)
                    .sort((a, b) => a.id - b.id),
            })),
        [tarea.subtareas]
    );

    const activas = tarea.subtareas.filter((s) => s.activo !== false);

    const handleDragStart = (event: DragStartEvent) => {
        const id = String(event.active.id);
        const subtarea = tarea.subtareas.find((s) => `sub-${s.id}` === id);
        setActiva(subtarea ?? null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiva(null);
        const overId = event.over?.id ? String(event.over.id) : "";
        if (!overId.startsWith("col-")) return;
        const destino = overId.slice(4);
        const subtarea = event.active.data.current?.subtarea as Subtarea | undefined;
        if (!subtarea) return;
        onMove(subtarea, destino);
    };

    if (activas.length === 0) {
        return (
            <div className={styles.boardEmpty}>
                <strong>Sin subtareas activas</strong>
                <p>
                    {tarea.estado === "APROBADO"
                        ? "Inicia la tarea para crear y asignar subtareas."
                        : tarea.estado === "SOLUCIONADO"
                            ? "La solicitud está solucionada."
                            : "No hay subtareas para mostrar en el tablero."}
                </p>
            </div>
        );
    }

    return (
        <div>
            <p className={styles.boardHint}>
                {tarea.estado === "APROBADO"
                    ? "Solicitud programada: puedes iniciar una subtarea antes de la hora establecida."
                    : "Arrastra las tarjetas entre columnas para modificar su estado"}
            </p>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiva(null)}
            >
                <div className={styles.board}>
                    {columnas.map((columna) => (
                        <Columna
                            key={columna.key}
                            estado={columna.key}
                            label={columna.label}
                            subtareas={columna.subtareas}
                            tarea={tarea}
                            puedeMover={puedeMover}
                            procesandoId={procesandoId ?? null}
                            onMove={onMove}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={null}>
                    {activa && (
                        <div className={styles.dragOverlayCard}>
                            <span className={styles.subtaskCode}>{activa.codigo ?? `#${activa.id}`}</span>
                            <strong>{activa.descripcion}</strong>
                            <span>{activa.asignado_nombre}</span>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
