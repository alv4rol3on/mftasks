"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { formatearTiempo, segundosLaboralesEntre } from "@/lib/tiempoLaboral";

interface Props {
    tareaId: number;
    subtareaId: number;
    estado: string;
    fallbackTiempoTomado?: number | null;
    fallbackFormateado?: string | null;
}

interface ContadorSub {
    activo: boolean;
    pausado: boolean;
    finalizado: boolean;
    segundos_restantes: number;
    con_retraso?: boolean;
    segundos_retraso?: number | null;
    tiempo_tomado_segundos: number | null;
    incluye_sabado?: boolean;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
    servidor_ahora?: string;
}

type Snap = { raw: ContadorSub; serverAhora: Date };

const COLOR_RETRASO = "#dc2626";

function TextoExcedido({ segundos }: { segundos: number }) {
    return (
        <span style={{ fontSize: 11, color: COLOR_RETRASO, fontWeight: 700 }}>
            +{formatearTiempo(segundos)} excedido
        </span>
    );
}

export default function SubtaskCountdown({ tareaId, subtareaId, estado, fallbackTiempoTomado, fallbackFormateado }: Props) {
    const [snapshot, setSnapshot] = useState<Snap | null>(null);
    // displaySec es "firmado": positivo = restante, negativo = excedido.
    const [displaySec, setDisplaySec] = useState<number | null>(null);
    const snapshotRef = useRef<Snap | null>(null);
    const [tiempoTomado, setTiempoTomado] = useState<number | null>(fallbackTiempoTomado ?? null);

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    useEffect(() => {
        if (estado === "SOLUCIONADO" && fallbackTiempoTomado !== undefined && fallbackTiempoTomado !== null) {
            return;
        }
        let cancelado = false;
        let poll: ReturnType<typeof setInterval> | null = null;
        let tick: ReturnType<typeof setInterval> | null = null;
        let lastFetch = 0;

        const baseFirmada = (raw: ContadorSub) =>
            raw.con_retraso ? -(raw.segundos_retraso ?? 0) : raw.segundos_restantes;

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
                    setDisplaySec(baseFirmada(data));
                } else {
                    const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date());
                    setDisplaySec(baseFirmada(data) - elapsed);
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
            const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date());
            setDisplaySec(baseFirmada(snap.raw) - elapsed);
        }, 1000);

        const onVis = () => { if (document.visibilityState === "visible" && Date.now() - lastFetch > 5000) cargar(); };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            cancelado = true;
            if (poll) clearInterval(poll);
            if (tick) clearInterval(tick);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [tareaId, subtareaId, estado, fallbackTiempoTomado]);

    const tomadoMostrado = (estado === "SOLUCIONADO" && fallbackTiempoTomado !== undefined && fallbackTiempoTomado !== null)
        ? fallbackTiempoTomado
        : tiempoTomado;

    if (tomadoMostrado !== null) {
        return <span style={{ fontSize: 11, color: "#166534" }}>{fallbackFormateado ? `Tomado: ${fallbackFormateado}` : `Tomado: ${formatearTiempo(tomadoMostrado)}`}</span>;
    }
    const snap = snapshot;
    if (snap && snap.raw.pausado) {
        if (displaySec !== null && displaySec < 0) return <TextoExcedido segundos={-displaySec} />;
        return <span style={{ fontSize: 11, color: "#92400e" }}>En pausa</span>;
    }
    if (displaySec === null) return <span style={{ fontSize: 11 }}>—</span>;
    if (displaySec < 0) return <TextoExcedido segundos={-displaySec} />;
    if (snap && !snap.raw.activo && estado === "EN_ESPERA") return <span style={{ fontSize: 11 }}>{formatearTiempo(displaySec)}</span>;
    return <span style={{ fontSize: 11 }}>{formatearTiempo(displaySec)}</span>;
}
