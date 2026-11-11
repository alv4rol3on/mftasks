"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from "react";
import { obtenerAccessToken } from "@/lib/auth";
import { apiBaseUrl } from "@/lib/authConfig";
import { refrescarTokens } from "@/lib/api";

export type TaskWebSocketEvent = {
    type: string;
    task_id: number;
    estado_nuevo?: string;
    progreso?: number;
    activo?: boolean;
    confirmacion_cliente?:
    | "PENDIENTE"
    | "CONFIRMADA"
    | "REABIERTA"
    | null;

    [key: string]: unknown;
};

export type SubtaskWebSocketEvent = {
    type: string;
    task_id: number;
    subtarea_id: number;
    estado_nuevo?: string;
    activo?: boolean;
    [key: string]: unknown;
};

type TasksWebSocketContextType = {
    eventos: Record<number, TaskWebSocketEvent>;
    subtareaEventos: Record<number, SubtaskWebSocketEvent>;
    observarTarea: (taskId: number) => void;
    dejarDeObservarTarea: (taskId: number) => void;
    wsDisponible: boolean;
};

const TasksWebSocketContext =
    createContext<TasksWebSocketContextType | null>(null);

const RECONEXION_MS = 3000;

/**
 * Base del WebSocket apuntando directo al backend (daphne), igual que el REST.
 * Evita depender del rewrite/proxy WS de Next, que no maneja bien el upgrade.
 * - NEXT_PUBLIC_WS_URL tiene prioridad (ej. ws://localhost:8000).
 * - Si no, deriva de NEXT_PUBLIC_API_URL cambiando http->ws / https->wss.
 * - Fallback: mismo origen (comportamiento anterior).
 */
function wsBaseUrl(): string | null {
    const explicito = process.env.NEXT_PUBLIC_WS_URL?.trim();
    if (explicito) return explicito.replace(/\/+$/, "");

    const api = (apiBaseUrl || "").trim();
    if (api) {
        try {
            const base = new URL(api, window.location.origin);
            const protocol = base.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${base.host}`;
        } catch {
            return null;
        }
    }

    // El proxy de Next no hace upgrade de WebSocket de forma fiable.
    // Solo se permite same-origin si se habilita explícitamente.
    if (process.env.NEXT_PUBLIC_WS_SAME_ORIGIN === "true") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${window.location.host}`;
    }

    return null;
}

export function TasksWebSocketProvider({
    children,
}: {
    children: ReactNode;
}) {
    const sockets = useRef<Record<number, WebSocket>>({});
    const deseados = useRef<Set<number>>(new Set());
    const reconexiones = useRef<Record<number, ReturnType<typeof setTimeout>>>(
        {}
    );
    const abrirSocketRef = useRef<(taskId: number) => void>(() => { });
    const falloGlobal = useRef(false);
    const avisoMostrado = useRef(false);
    const refreshIntentado = useRef<Set<number>>(new Set());

    const [wsDisponible, setWsDisponible] = useState(true);

    const [eventos, setEventos] =
        useState<Record<number, TaskWebSocketEvent>>({});

    const [subtareaEventos, setSubtareaEventos] =
        useState<Record<number, SubtaskWebSocketEvent>>({});

    const marcarNoDisponible = useCallback((codigo?: number, motivo?: string) => {
        if (falloGlobal.current) return;

        falloGlobal.current = true;
        setWsDisponible(false);

        if (!avisoMostrado.current) {
            avisoMostrado.current = true;
            const detalle = [
                codigo ? `código ${codigo}` : "",
                motivo ? `motivo: ${motivo}` : "",
            ].filter(Boolean).join(", ");
            console.info(
                "WebSocket no disponible; se usará actualización periódica." +
                (detalle ? ` (${detalle})` : "")
            );
        }
    }, []);

    const abrirSocket = useCallback((taskId: number) => {
        if (typeof window === "undefined") return;
        if (falloGlobal.current) return;
        if (sockets.current[taskId]) return;

        const token = obtenerAccessToken();

        if (!token) return;

        const base = wsBaseUrl();

        if (!base) {
            marcarNoDisponible();
            return;
        }

        const url =
            `${base}/ws/tareas/${taskId}/` +
            `?token=${encodeURIComponent(token)}`;

        const ws = new WebSocket(url);

        ws.onopen = () => {
            falloGlobal.current = false;
            refreshIntentado.current.delete(taskId);
            setWsDisponible(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);


                if (data.type === "task_status_changed") {
                    setEventos((prev) => ({ ...prev, [taskId]: data }));

                    const solicitudCerrada =
                        data.estado_nuevo === "RECHAZADO" ||
                        data.estado_nuevo === "CANCELADO" ||
                        (
                            data.estado_nuevo === "SOLUCIONADO" &&
                            data.confirmacion_cliente === "CONFIRMADA"
                        );

                    if (solicitudCerrada) {
                        // Evitar que onclose intente reconectar.
                        deseados.current.delete(taskId);

                        const timer = reconexiones.current[taskId];

                        if (timer) {
                            clearTimeout(timer);
                            delete reconexiones.current[taskId];
                        }

                        const socket = sockets.current[taskId];

                        if (socket) {
                            socket.close(1000, "Solicitud cerrada definitivamente");
                        }
                    }

                    return;
                }


                if (data.type === "subtask_status_changed") {
                    setSubtareaEventos((prev) => ({
                        ...prev,
                        [data.subtarea_id]: data,
                    }));
                }
            } catch {
                // Ignorar mensajes no JSON o inválidos.
            }
        };

        ws.onerror = () => {
            // El cierre se maneja en onclose para evitar ruido y duplicados.
        };

        ws.onclose = (event) => {
            delete sockets.current[taskId];

            if (!deseados.current.has(taskId)) return;

            if (event.code === 4403 && !refreshIntentado.current.has(taskId)) {
                refreshIntentado.current.add(taskId);
                void refrescarTokens().then((renovado) => {
                    if (renovado && deseados.current.has(taskId)) {
                        reconexiones.current[taskId] = setTimeout(() => {
                            delete reconexiones.current[taskId];
                            if (deseados.current.has(taskId)) {
                                abrirSocketRef.current(taskId);
                            }
                        }, RECONEXION_MS);
                    } else {
                        marcarNoDisponible(event.code, event.reason);
                    }
                });
                return;
            }

            marcarNoDisponible(event.code, event.reason);
        };

        sockets.current[taskId] = ws;
    }, [marcarNoDisponible]);

    useEffect(() => {
        abrirSocketRef.current = abrirSocket;
    }, [abrirSocket]);

    const observarTarea = useCallback(
        (taskId: number) => {
            deseados.current.add(taskId);
            abrirSocket(taskId);
        },
        [abrirSocket]
    );

    const dejarDeObservarTarea = useCallback((taskId: number) => {
        deseados.current.delete(taskId);

        const timer = reconexiones.current[taskId];
        if (timer) {
            clearTimeout(timer);
            delete reconexiones.current[taskId];
        }

        const ws = sockets.current[taskId];
        if (ws) {
            ws.close();
            delete sockets.current[taskId];
        }

        setEventos((prev) => {
            const nuevo = { ...prev };
            delete nuevo[taskId];
            return nuevo;
        });

        setSubtareaEventos((prev) => {
            const nuevo: Record<number, SubtaskWebSocketEvent> = {};

            Object.values(prev).forEach((evento) => {
                if (evento.task_id !== taskId) {
                    nuevo[evento.subtarea_id] = evento;
                }
            });

            return nuevo;
        });
    }, []);

    useEffect(() => {
        const setDeseados = deseados.current;
        const mapReconexiones = reconexiones.current;
        const mapSockets = sockets.current;

        return () => {
            setDeseados.clear();

            Object.values(mapReconexiones).forEach((timer) =>
                clearTimeout(timer)
            );
            reconexiones.current = {};

            Object.values(mapSockets).forEach((ws) => ws.close());
            sockets.current = {};
        };
    }, []);

    const value = useMemo(
        () => ({
            eventos,
            subtareaEventos,
            observarTarea,
            dejarDeObservarTarea,
            wsDisponible,
        }),
        [eventos, subtareaEventos, observarTarea, dejarDeObservarTarea, wsDisponible]
    );

    return (
        <TasksWebSocketContext.Provider value={value}>
            {children}
        </TasksWebSocketContext.Provider>
    );
}

export function useTasksWebSocket() {
    const context = useContext(TasksWebSocketContext);

    if (!context) {
        throw new Error(
            "useTasksWebSocket debe utilizarse dentro de TasksWebSocketProvider"
        );
    }

    return context;
}
