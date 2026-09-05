"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { estaEnJornada, formatearTiempo } from "@/lib/tiempoLaboral";

interface TaskCountdownProps {
    tareaId: number;
    incluyeSabado?: boolean;
}

interface ContadorResponse {
    activo: boolean;
    pausado: boolean;
    finalizado: boolean;
    segundos_restantes: number;
    tiempo_tomado_segundos: number | null;
    tiempo_planificado_segundos?: number | null;
    incluye_sabado?: boolean;
    fecha_entrega_aproximada: string | null;
    fecha_inicio?: string | null;
    fecha_solucion?: string | null;
    servidor_ahora: string;
}

export default function TaskCountdown({
    tareaId,
    incluyeSabado,
}: TaskCountdownProps) {
    const [segundos, setSegundos] = useState<number | null>(null);
    const [tiempoTomado, setTiempoTomado] = useState<number | null>(null);
    const [pausado, setPausado] = useState(false);
    const [activo, setActivo] = useState(false);
    const incluyeRef = useRef<boolean>(!!incluyeSabado);
    const activoRef = useRef(false);
    const pausadoRef = useRef(false);

    useEffect(() => {
        let cancelado = false;
        let poll: ReturnType<typeof setInterval> | null = null;
        let tick: ReturnType<typeof setInterval> | null = null;

        const cargar = async () => {
            try {
                const data = await apiFetch<ContadorResponse>(
                    `/api/tasks/tasks/${tareaId}/contador/`
                );
                if (cancelado) return;
                // resolver incluye_sabado: prop > response
                const incluye = typeof incluyeSabado === "boolean" ? incluyeSabado : !!data.incluye_sabado;
                incluyeRef.current = incluye;
                setTiempoTomado(data.tiempo_tomado_segundos);
                setPausado(data.pausado);
                setActivo(data.activo);
                setSegundos(data.segundos_restantes);
                activoRef.current = data.activo;
                pausadoRef.current = data.pausado;
            } catch (error) {
                console.error("Error cargando contador:", error);
            }
        };

        cargar();
        // polling servidor cada 60s para corregir drift laboral y standby
        poll = setInterval(cargar, 60000);
        // tick local cada 1s solo si está en jornada laboral
        tick = setInterval(() => {
            if (!activoRef.current || pausadoRef.current) return;
            if (!estaEnJornada(new Date(), incluyeRef.current)) return;
            setSegundos((prev) => {
                if (prev === null) return prev;
                return Math.max(0, prev - 1);
            });
        }, 1000);

        // refetch cuando vuelve a pestaña
        const onVis = () => {
            if (document.visibilityState === "visible") cargar();
        };
        document.addEventListener("visibilitychange", onVis);

        return () => {
            cancelado = true;
            if (poll) clearInterval(poll);
            if (tick) clearInterval(tick);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [tareaId, incluyeSabado]);

    if (tiempoTomado !== null) {
        return <span>Tiempo tomado: {formatearTiempo(tiempoTomado)}</span>;
    }
    if (pausado) {
        return <span>En pausa</span>;
    }
    if (segundos === null) {
        return <span>Calculando...</span>;
    }
    if (!activo && segundos === 0) {
        // puede ser tarea no iniciada o vencida
        return <span>{formatearTiempo(segundos)}</span>;
    }
    return <span>{formatearTiempo(segundos)}</span>;
}
