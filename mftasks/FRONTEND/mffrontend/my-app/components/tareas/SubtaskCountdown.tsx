"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatearTiempo } from "@/lib/tiempoLaboral";

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

export default function SubtaskCountdown({ tareaId, subtareaId, estado, fallbackTiempoTomado, fallbackFormateado }: Props) {
    const [tiempoTomado, setTiempoTomado] = useState<number | null>(fallbackTiempoTomado ?? null);
    const [segRestante, setSegRestante] = useState<number | null>(null);
    const [pausado, setPausado] = useState(false);
    const [activo, setActivo] = useState(false);

    useEffect(() => {
        if (estado === "SOLUCIONADO" && fallbackTiempoTomado !== undefined && fallbackTiempoTomado !== null) {
            setTiempoTomado(fallbackTiempoTomado);
            return;
        }
        let cancelado = false;
        let poll: ReturnType<typeof setInterval> | null = null;
        let lastFetch = 0;

        const cargar = async () => {
            if (Date.now() - lastFetch < 2000) return;
            lastFetch = Date.now();
            try {
                const data = await apiFetch<ContadorSub>(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/contador/`);
                if (cancelado) return;
                if (data.tiempo_tomado_segundos !== null) {
                    setTiempoTomado(data.tiempo_tomado_segundos);
                    setSegRestante(null);
                    setPausado(false);
                    setActivo(false);
                    return;
                }
                setTiempoTomado(data.tiempo_tomado_segundos);
                setSegRestante(data.segundos_restantes);
                setPausado(!!data.pausado);
                setActivo(!!data.activo);
            } catch {
                if (fallbackTiempoTomado !== null && fallbackTiempoTomado !== undefined) setTiempoTomado(fallbackTiempoTomado);
            }
        };

        cargar();
        poll = setInterval(cargar, 15000);

        const onVis = () => { if (document.visibilityState === "visible") cargar(); };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            cancelado = true;
            if (poll) clearInterval(poll);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [tareaId, subtareaId, estado, fallbackTiempoTomado]);

    if (tiempoTomado !== null) {
        return <span style={{ fontSize: 11, color: "#166534" }}>{fallbackFormateado ? `Tomado: ${fallbackFormateado}` : `Tomado: ${formatearTiempo(tiempoTomado)}`}</span>;
    }
    if (pausado) return <span style={{ fontSize: 11, color: "#92400e" }}>En pausa</span>;
    if (segRestante === null) return <span style={{ fontSize: 11 }}>—</span>;
    if (!activo && estado === "EN_ESPERA") return <span style={{ fontSize: 11 }}>{formatearTiempo(segRestante)} (heredado)</span>;
    return <span style={{ fontSize: 11 }}>{formatearTiempo(segRestante)}</span>;
}
