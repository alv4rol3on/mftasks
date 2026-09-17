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

export type TaskWebSocketEvent = {
    type: string;
    task_id: number;
    estado_nuevo?: string;
    progreso?: number;
    activo?: boolean;
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
function wsBaseUrl(): string {
    const explicito = process.env.NEXT_PUBLIC_WS_URL?.trim();
    if (explicito) return explicito.replace(/\/+$/, "");

    try {
        const base = new URL(apiBaseUrl, window.location.origin);
        const protocol = base.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${base.host}`;
    } catch {
        const protocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${window.location.host}`;
    }
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
    const abrirSocketRef = useRef<(taskId: number) => void>(() => {});

    const [eventos, setEventos] =
        useState<Record<number, TaskWebSocketEvent>>({});

    const [subtareaEventos, setSubtareaEventos] =
        useState<Record<number, SubtaskWebSocketEvent>>({});

    const abrirSocket = useCallback((taskId: number) => {
        if (typeof window === "undefined") return;

        if (sockets.current[taskId]) return;

        const token = obtenerAccessToken();

        if (!token) return;

        const url =
            `${wsBaseUrl()}/ws/tareas/${taskId}/` +
            `?token=${encodeURIComponent(token)}`;

        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log(`>>> WS TAREA ${taskId} CONECTADO`);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "task_status_changed") {
                    setEventos((prev) => ({ ...prev, [taskId]: data }));
                    return;
                }

                if (data.type === "subtask_status_changed") {
                    setSubtareaEventos((prev) => ({
                        ...prev,
                        [data.subtarea_id]: data,
                    }));
                }
            } catch (error) {
                console.error(
                    "Error procesando mensaje WebSocket:",
                    error
                );
            }
        };

        ws.onerror = (error) => {
            console.error(`>>> WS TAREA ${taskId} ERROR`, error);
        };

        ws.onclose = (event) => {
            console.log(`>>> WS TAREA ${taskId} CERRADO`, {
                code: event.code,
                reason: event.reason,
            });

            delete sockets.current[taskId];

            if (!deseados.current.has(taskId)) return;

            const anterior = reconexiones.current[taskId];
            if (anterior) clearTimeout(anterior);

            reconexiones.current[taskId] = setTimeout(() => {
                delete reconexiones.current[taskId];
                if (deseados.current.has(taskId)) {
                    abrirSocketRef.current(taskId);
                }
            }, RECONEXION_MS);
        };

        sockets.current[taskId] = ws;
    }, []);

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
        }),
        [eventos, subtareaEventos, observarTarea, dejarDeObservarTarea]
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
