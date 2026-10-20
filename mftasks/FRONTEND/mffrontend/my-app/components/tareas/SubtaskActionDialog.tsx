"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Subtarea, Task } from "@/lib/types";
import styles from "./TareaDetalle.module.css";

type Props = {
    tipo: "pausa" | "solucionar" | "reanudar";
    subtarea: Subtarea;
    tarea: Task;
    procesando?: boolean;
    onClose: () => void;
    onPausa: (motivo: string) => Promise<void>;
    onSolucionar: () => Promise<void>;
    onReanudar: (opts: { modo: "continuar" | "nueva_fecha" | "mantener"; nuevaFechaEntrega?: string }) => Promise<void>;
};

const aDatetimeLocal = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const maxNuevaFecha = (() => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 5);
    const offset = fecha.getTimezoneOffset();
    return new Date(fecha.getTime() - offset * 60000).toISOString().slice(0, 16);
})();

export default function SubtaskActionDialog({
    tipo,
    subtarea,
    tarea,
    procesando,
    onClose,
    onPausa,
    onSolucionar,
    onReanudar,
}: Props) {
    const [motivo, setMotivo] = useState("");
    const [modo, setModo] = useState<"continuar" | "nueva_fecha" | "mantener">("continuar");
    const [nuevaFecha, setNuevaFecha] = useState(() => aDatetimeLocal(tarea.fecha_entrega_aproximada));
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const bloqueado = !!procesando || enviando;

    const minNuevaFecha = (() => {
        if (!tarea.fecha_entrega_aproximada) return undefined;
        const d = new Date(tarea.fecha_entrega_aproximada);
        if (isNaN(d.getTime())) return undefined;
        d.setMinutes(d.getMinutes() + 1);
        return aDatetimeLocal(d.toISOString());
    })();

    const titulo = tipo === "pausa"
        ? "Pausar subtarea"
        : tipo === "solucionar"
            ? "Solucionar subtarea"
            : "Reanudar subtarea";

    const confirmar = async () => {
        setError(null);
        setEnviando(true);
        try {
            if (tipo === "pausa") {
                const limpio = motivo.trim();
                if (!limpio) {
                    setError("El motivo de pausa es obligatorio.");
                    return;
                }
                await onPausa(limpio);
            } else if (tipo === "solucionar") {
                await onSolucionar();
            } else {
                if (modo === "nueva_fecha") {
                    if (!nuevaFecha) {
                        setError("Selecciona la nueva fecha de entrega.");
                        return;
                    }
                    const d = new Date(nuevaFecha);
                    if (isNaN(d.getTime())) {
                        setError("La fecha indicada no es válida.");
                        return;
                    }
                    await onReanudar({ modo: "nueva_fecha", nuevaFechaEntrega: d.toISOString() });
                } else {
                    await onReanudar({ modo });
                }
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal
            title={titulo}
            onClose={bloqueado ? () => {} : onClose}
            footer={
                <>
                    <button type="button" className={styles.dialogCancel} onClick={onClose} disabled={bloqueado}>
                        Cancelar
                    </button>
                    <button type="button" className={styles.dialogConfirm} onClick={() => void confirmar()} disabled={bloqueado}>
                        {bloqueado ? "Guardando…" : "Confirmar"}
                    </button>
                </>
            }
        >
            <div className={styles.dialog}>
                <p className={styles.dialogIntro}>
                    <strong>{subtarea.codigo ?? `#${subtarea.id}`}</strong> {subtarea.descripcion}
                </p>

                {tipo === "pausa" && (
                    <label className={styles.dialogField}>
                        <span>Motivo de pausa <span aria-hidden="true">*</span></span>
                        <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            rows={4}
                            autoFocus
                            className={styles.dialogTextarea}
                            placeholder="Indica por qué se pausa la subtarea"
                            disabled={bloqueado}
                        />
                    </label>
                )}

                {tipo === "solucionar" && (
                    <p className={styles.dialogText}>
                        ¿Confirmas que la subtarea está solucionada? Se bloqueará en estado Solucionado y no se podrá cambiar su estado.
                    </p>
                )}

                {tipo === "reanudar" && (
                    <div className={styles.resumeOptions}>
                        <p className={styles.dialogText}>Elige cómo continuar la cuenta regresiva de la solicitud.</p>

                        <label className={styles.radioOption}>
                            <input
                                type="radio"
                                name="modo-reanudar"
                                checked={modo === "continuar"}
                                onChange={() => { setModo("continuar"); setError(null); }}
                                disabled={bloqueado}
                            />
                            <span>
                                <strong>Continuar cuenta regresiva</strong>
                                <small>Sigue desde donde se quedó; la entrega se amplía por el tiempo en pausa.</small>
                            </span>
                        </label>

                        <label className={styles.radioOption}>
                            <input
                                type="radio"
                                name="modo-reanudar"
                                checked={modo === "nueva_fecha"}
                                onChange={() => { setModo("nueva_fecha"); setError(null); }}
                                disabled={bloqueado}
                            />
                            <span>
                                <strong>Nueva fecha de entrega</strong>
                                <small>Debe ser posterior a la fecha actual y al inicio de la solicitud.</small>
                            </span>
                        </label>

                        {modo === "nueva_fecha" && (
                            <label className={styles.dialogField}>
                                <span>Nueva fecha de entrega</span>
                                <input
                                    type="datetime-local"
                                    value={nuevaFecha}
                                    min={minNuevaFecha}
                                    max={maxNuevaFecha}
                                    onChange={(e) => setNuevaFecha(e.target.value)}
                                    className={styles.dialogInput}
                                    disabled={bloqueado}
                                />
                                <small>Máximo permitido: 5 días desde hoy.</small>
                            </label>
                        )}
                    </div>
                )}

                {error && <p className={styles.dialogError} role="alert">{error}</p>}
            </div>
        </Modal>
    );
}
