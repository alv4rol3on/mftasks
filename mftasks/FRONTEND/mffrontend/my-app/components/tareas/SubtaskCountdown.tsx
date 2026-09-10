"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { formatearTiempo, segundosLaboralesEntre } from "@/lib/tiempoLaboral";

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

type Snap = { raw: ContadorSub; serverAhora: Date };

export default function SubtaskCountdown({ tareaId, subtareaId, estado, incluyeSabado, fallbackTiempoTomado, fallbackFormateado }: Props) {
    const [snapshot, setSnapshot] = useState<Snap | null>(null);
    const [displaySec, setDisplaySec] = useState<number | null>(null);
    const snapshotRef = useRef<Snap | null>(null);
    snapshotRef.current = snapshot;
    const [tiempoTomado, setTiempoTomado] = useState<number | null>(fallbackTiempoTomado ?? null);

    useEffect(() => {
        if (estado === "SOLUCIONADO" && fallbackTiempoTomado !== undefined && fallbackTiempoTomado !== null) {
            setTiempoTomado(fallbackTiempoTomado);
            return;
        }
        let cancelado = false;
        let poll: ReturnType<typeof setInterval> | null = null;
        let tick: ReturnType<typeof setInterval> | null = null;
        let lastFetch = 0;

        const cargar = async () => {
            if (Date.now() - lastFetch < 2000) return;
            lastFetch = Date.now();
            try {
                const data = await apiFetch<ContadorSub>(`/api/tasks/tasks/${tareaId}/subtareas/${subtareaId}/contador/`);
                if (cancelado) return;
                if (data.tiempo_tomado_segundos !== null) {
                    setTiempoTomado(data.tiempo_tomado_segundos);
                    setSnapshot(null);
                    setDisplaySec(null);
                    return;
                }
                const snap: Snap = { raw: data, serverAhora: data.servidor_ahora ? new Date(data.servidor_ahora) : new Date() };
                setSnapshot(snap);
                setTiempoTomado(data.tiempo_tomado_segundos);
                if (!data.activo || data.pausado) {
                    setDisplaySec(data.segundos_restantes);
                } else {
                    const incluye = typeof incluyeSabado === "boolean" ? incluyeSabado : !!data.incluye_sabado;
                    const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date(), incluye);
                    setDisplaySec(Math.max(0, data.segundos_restantes - elapsed));
                }
            } catch {
                if (fallbackTiempoTomado !== null && fallbackTiempoTomado !== undefined) setTiempoTomado(fallbackTiempoTomado);
            }
        };

        cargar();
        poll = setInterval(cargar, 30000);
        tick = setInterval(() => {
            const snap = snapshotRef.current;
            if (!snap) return;
            if (!snap.raw.activo || snap.raw.pausado || snap.raw.tiempo_tomado_segundos !== null) return;
            const incluye = typeof incluyeSabado === "boolean" ? incluyeSabado : !!snap.raw.incluye_sabado;
            const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date(), incluye);
            setDisplaySec(Math.max(0, snap.raw.segundos_restantes - elapsed));
        }, 1000);

        const onVis = () => { if (document.visibilityState === "visible" && Date.now() - lastFetch > 5000) cargar(); };
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
    const snap = snapshot;
    if (snap && snap.raw.pausado) return <span style={{ fontSize: 11, color: "#92400e" }}>En pausa</span>;
    if (displaySec === null) return <span style={{ fontSize: 11 }}>—</span>;
    if (snap && !snap.raw.activo && estado === "EN_ESPERA") return <span style={{ fontSize: 11 }}>{formatearTiempo(displaySec)} (heredado)</span>;
    return <span style={{ fontSize: 11 }}>{formatearTiempo(displaySec)}</span>;
}
