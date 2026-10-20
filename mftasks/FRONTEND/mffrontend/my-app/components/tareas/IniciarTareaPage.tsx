"use client";

import { useRouter } from "next/navigation";
import { useTareaDetalle } from "@/app/mfpages/tareas/hooks/useTareaDetalle";
import { useTareaAcciones } from "@/app/mfpages/tareas/hooks/useTareaAcciones";
import { getUsuarioActual } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import TaskStatusBadge from "@/components/tareas/TaskStatusBadge";
import TaskIniciarForm from "@/components/tareas/TaskIniciarForm";
import detailStyles from "./TareaDetalle.module.css";
import styles from "./IniciarTarea.module.css";

export default function IniciarTareaPage({
    tareaId,
    rutaTarea,
}: {
    tareaId: number | null;
    rutaTarea: string;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const { tarea, cargando, error, cargar } = useTareaDetalle(tareaId);
    const acciones = useTareaAcciones({
        cargar,
        onSolicitudResuelta: (_id, res) => {
            if (!res?.solicitud_resuelta) return;
            showToast("La solicitud fue resuelta.", "success");
        },
    });
    const usuario = getUsuarioActual();
    const esAdmin = (usuario?.roles ?? []).map((r) => r.toLowerCase()).includes("administrador");
    const volverAlDetalle = () => {
        if (tareaId) {
            router.push(`/mfpages/tareas/${rutaTarea}`);
        } else {
            router.push("/mfpages/tareas");
        }
    };

    if (tareaId === null) {
        return (
            <div className={detailStyles.page}>
                <div className={detailStyles.statePanel}>
                    <strong>Solicitud no válida</strong>
                    <p>La dirección no contiene un identificador de solicitud válido.</p>
                    <button type="button" className={detailStyles.secondaryButton} onClick={() => router.push("/mfpages/tareas")}>
                        Volver a Tareas en desarrollo
                    </button>
                </div>
            </div>
        );
    }

    if (cargando) {
        return (
            <div className={detailStyles.page}>
                <div className={detailStyles.loadingPanel} aria-label="Cargando solicitud">
                    <div className={detailStyles.skeletonHeader} />
                    <div className={detailStyles.skeletonBlock} />
                </div>
            </div>
        );
    }

    if (error || !tarea) {
        return (
            <div className={detailStyles.page}>
                <div className={`${detailStyles.statePanel} ${detailStyles.errorState}`} role="alert">
                    <strong>No se pudo abrir la solicitud</strong>
                    <p>{error ?? "La solicitud no existe o no tienes acceso a ella."}</p>
                    <div className={detailStyles.stateActions}>
                        <button type="button" className={detailStyles.secondaryButton} onClick={() => router.push("/mfpages/tareas")}>
                            Volver
                        </button>
                        <button type="button" className={detailStyles.primaryButton} onClick={() => void cargar()}>
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const puedeIniciar = tarea.estado === "APROBADO" && tarea.subtareas.length === 0 && !!tarea.puedo_operar && !esAdmin;

    if (!puedeIniciar) {
        return (
            <div className={detailStyles.page}>
                <button type="button" className={detailStyles.backLink} onClick={volverAlDetalle}>
                    ← Volver al detalle
                </button>
                <div className={detailStyles.statePanel}>
                    <strong>La solicitud no está disponible para iniciar</strong>
                    <p>
                        {tarea.estado === "APROBADO"
                            ? tarea.subtareas.length > 0
                                ? "Esta solicitud ya tiene subtareas creadas."
                                : "No tienes permiso para iniciar esta solicitud."
                            : "Solo se puede iniciar una solicitud aprobada y sin subtareas."}
                    </p>
                    <button type="button" className={detailStyles.secondaryButton} onClick={volverAlDetalle}>
                        Volver al detalle
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={detailStyles.page}>
            <button type="button" className={detailStyles.backLink} onClick={volverAlDetalle}>
                ← Volver al detalle
            </button>

            <header className={detailStyles.detailHeader}>
                <div className={detailStyles.headerMain}>
                    <div className={detailStyles.headerTopline}>
                        <span className={detailStyles.headerTicket}>{tarea.ticket ?? `Tarea #${tarea.id}`}</span>
                        <TaskStatusBadge estado={tarea.estado} />
                    </div>
                    <h2 className={detailStyles.headerTitle}>Iniciar tarea: {tarea.asunto}</h2>
                    <div className={detailStyles.headerMeta}>
                        <span className={detailStyles.headerMetric}>
                            <span className={detailStyles.headerMetricLabel}>Equipo</span>
                            <strong>{tarea.equipo_nombre || "-"}</strong>
                        </span>
                        <span className={detailStyles.headerTimer}>Define las fechas y las subtareas de la solicitud.</span>
                    </div>
                </div>
            </header>

            <div className={styles.formCard}>
                <div className={styles.intro}>
                    <h3 className={styles.introTitle}>Planificación inicial</h3>
                    <p className={styles.introText}>
                        Al iniciar la tarea se crearán las subtareas y dependencias indicadas.
                    </p>
                </div>

                <TaskIniciarForm
                    tarea={tarea}
                    accionando={acciones.accionando === tarea.id}
                    onCancel={volverAlDetalle}
                    onSubmit={async (t, payload) => {
                        await acciones.iniciar(t, payload);
                        router.replace(`/mfpages/tareas/${rutaTarea}`);
                    }}
                />
            </div>
        </div>
    );
}
