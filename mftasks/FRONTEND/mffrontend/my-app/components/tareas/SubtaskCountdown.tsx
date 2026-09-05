"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { estaEnJornada, formatearTiempo } from "@/lib/tiempoLaboral";

interface Props {
    tareaId: number;
    subtareaId: number;
    estado: string;
    incluyeSabado?: boolean;
    fallbackTiempoTomado?: number | null;
    fallbackFormateado?: string | null;
}

interface ContadorSub {
    activo: boolean;
    pausado: boolean;
    finalizado: boolean;
    segundos_restantes: number;
    tiempo_tomado_segundos: number | null;
    incluye_sabado?: boolean;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    servidor_ahora?: string;
}

export default function SubtaskCountdown({ tareaId, subtareaId, estado, incluyeSabado, fallbackTiempoTomado, fallbackFormateado }: Props) {
    const [segundos, setSegundos] = useState<number | null>(null);
    const [tiempoTomado, setTiempoTomado] = useState<number | null>(fallbackTiempoTomado ?? null);
    const [pausado, setPausado] = useState(false);
    const [activo, setActivo] = useState(false);
    const incluyeRef = useRef(!!incluyeSabado);
    const activoRef = useRef(false);
    const pausadoRef = useRef(false);

    useEffect(() => {
        // Si ya está solucionada y tenemos fallback, no fetchear
        if (estado === "SOLUCIONADO" && fallbackTiempoTomado !== undefined && fallbackTiempoTomado !== null) {
            setTiempoTomado(fallbackTiempoTomado);
            return;
        }
        let cancelado = false;
        let poll: ReturnType<typeof setInterval> | null = null;
        let tick: ReturnType<typeof setInterval> | null = null;

        const cargar = async () => {
            try {
                const data = await apiFetch<ContadorSub>(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/contador/`);
                if (cancelado) return;
                const incluye = typeof incluyeSabado === "boolean" ? incluyeSabado : !!data.incluye_sabado;
                incluyeRef.current = incluye;
                setTiempoTomado(data.tiempo_tomado_segundos);
                setPausado(data.pausado);
                setActivo(data.activo);
                setSegundos(data.segundos_restantes);
                activoRef.current = data.activo;
                pausadoRef.current = data.pausado;
            } catch {
                // si falla, usar fallback si existe
                if (fallbackTiempoTomado !== null && fallbackTiempoTomado !== undefined) {
                    setTiempoTomado(fallbackTiempoTomado);
                }
            }
        };

        cargar();
        poll = setInterval(cargar, 60000);
        tick = setInterval(() => {
            if (!activoRef.current || pausadoRef.current) return;
            if (!estaEnJornada(new Date(), incluyeRef.current)) return;
            setSegundos((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
        }, 1000);

        const onVis = () => { if (document.visibilityState === "visible") cargar(); };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            cancelado = true;
            if (poll) clearInterval(poll);
            if (tick) clearInterval(tick);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [tareaId, subtareaId, estado, incluyeSabado, fallbackTiempoTomado]);

    if (tiempoTomado !== null) {
        return <span style={{ fontSize: 11, color: "#166534" }}>{fallbackFormateado ? `Tomado: ${fallbackFormateado}` : `Tomado: ${formatearTiempo(tiempoTomado)}`}</span>;
    }
    if (pausado) return <span style={{ fontSize: 11, color: "#92400e" }}>En pausa</span>;
    if (segundos === null) return <span style={{ fontSize: 11 }}>—</span>;
    if (!activo && estado === "EN_ESPERA") return <span style={{ fontSize: 11 }}>{formatearTiempo(segundos)} (heredado)</span>;
    return <span style={{ fontSize: 11 }}>{formatearTiempo(segundos)}</span>;
}
