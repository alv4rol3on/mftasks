"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    ReactNode,
} from "react";

type TaskWebSocketEvent = {
    type: string;
    task_id: number;
    estado_nuevo?: string;
    [key: string]: unknown;
};

type TasksWebSocketContextType = {
    eventos: Record<number, TaskWebSocketEvent>;
    observarTarea: (taskId: number) => void;
    dejarDeObservarTarea: (taskId: number) => void;
};

const TasksWebSocketContext =
    createContext<TasksWebSocketContextType | null>(null);

export function TasksWebSocketProvider({
    children,
}: {
    children: ReactNode;
}) {
    const sockets = useRef<Record<number, WebSocket>>({});

    const [eventos, setEventos] =
        useState<Record<number, TaskWebSocketEvent>>({});

    const observarTarea = useCallback((taskId: number) => {
        // Ya existe una conexión para esta tarea
        if (sockets.current[taskId]) {
            return;
        }

        const protocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";

        const host = window.location.hostname;

        const ws = new WebSocket(
            `${protocol}//${host}:8000/ws/tareas/${taskId}/`
        );

        ws.onopen = () => {
            console.log(
                `>>> WS TAREA ${taskId} CONECTADO`
            );
        };

        ws.onmessage = (event) => {
            try {
                const data: TaskWebSocketEvent =
                    JSON.parse(event.data);

                console.log(
                    `>>> WS TAREA ${taskId} RECIBIDO:`,
                    data
                );

                if (data.type === "task_status_changed") {
                    setEventos((prev) => ({
                        ...prev,
                        [taskId]: data,
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
            console.error(`>>> WS TAREA ${taskId} ERROR`, {
                error,
                readyState: ws.readyState,
                url: ws.url,
            });
        };

        ws.onclose = (event) => {
            console.log(`>>> WS TAREA ${taskId} CERRADO`, {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
            });

            delete sockets.current[taskId];
        };

        sockets.current[taskId] = ws;
    }, []);

    const dejarDeObservarTarea = useCallback((taskId: number) => {
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
    }, []);

    useEffect(() => {
        return () => {
            Object.values(sockets.current).forEach((ws) => {
                ws.close();
            });

            sockets.current = {};
        };
    }, []);

    return (
        <TasksWebSocketContext.Provider
            value={{
                eventos,
                observarTarea,
                dejarDeObservarTarea,
            }}
        >
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

