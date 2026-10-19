"use client";

import styles from "./TaskModalDesarrollo.module.css";
import TaskIniciarForm, { type IniciarTareaPayload } from "./TaskIniciarForm";
import type { Task } from "@/lib/types";

interface TaskIniciarModalProps {
    tarea: Task;
    accionando?: boolean;
    onClose: () => void;
    onSubmit: (tarea: Task, payload: IniciarTareaPayload) => void | Promise<void>;
}

export default function TaskIniciarModal({
    tarea,
    accionando,
    onClose,
    onSubmit,
}: TaskIniciarModalProps) {
    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="iniciar-tarea-titulo"
            >
                <div className={styles.modalHeader}>
                    <div>
                        <h2 id="iniciar-tarea-titulo">{tarea.ticket ?? `Iniciar tarea #${tarea.id}`}</h2>
                        <p>{tarea.asunto}</p>
                    </div>

                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.iniciarBody}>
                    <TaskIniciarForm
                        tarea={tarea}
                        accionando={accionando}
                        onCancel={onClose}
                        onSubmit={onSubmit}
                    />
                </div>
            </div>
        </div>
    );
}
