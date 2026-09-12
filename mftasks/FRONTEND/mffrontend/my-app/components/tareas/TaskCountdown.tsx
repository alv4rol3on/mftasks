"use client";

import { formatearTiempo } from "@/lib/tiempoLaboral";
import { useContador } from "./ContadoresProvider";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface TaskCountdownProps {
  tareaId: number;
  incluyeSabado?: boolean;
}

interface ContadorResponseFallback {
  activo: boolean;
  pausado: boolean;
  finalizado: boolean;
  segundos_restantes: number;
  tiempo_tomado_segundos: number | null;
  segundos_extra?: number | null;
  servidor_ahora: string;
}

function BadgeExtra({ segundos }: { segundos: number }) {
  if (!segundos || segundos <= 0) return null;
  return <span style={{ marginLeft: 6, background: "#ede9fe", color: "#5b21b6", border: "1px solid #ddd6fe", padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>+{formatearTiempo(segundos)} anticipado</span>;
}

export default function TaskCountdown({ tareaId }: TaskCountdownProps) {
  const ctxData = useContador(tareaId);
  if (ctxData !== undefined) {
    if (ctxData === null) return <span>Calculando...</span>;
    const extra = (ctxData as any).segundos_extra ?? 0;
    if (ctxData.tiempo_tomado_segundos !== null) {
      return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>Tiempo tomado: {formatearTiempo(ctxData.tiempo_tomado_segundos)}<BadgeExtra segundos={extra} /></span>;
    }
    if (ctxData.pausado) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>En pausa<BadgeExtra segundos={extra} /></span>;
    return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>{formatearTiempo(ctxData.segundos_restantes)}<BadgeExtra segundos={extra} /></span>;
  }

  // Fallback sin Provider: poll puro al server (sin interpolación local, 100% logs)
  const [data, setData] = useState<ContadorResponseFallback | null>(null);

  useEffect(() => {
    let cancelado = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let lastFetch = 0;

    const cargar = async () => {
      if (Date.now() - lastFetch < 2000) return;
      lastFetch = Date.now();
      try {
        const res = await apiFetch<ContadorResponseFallback>(`/api/tasks/tasks/${tareaId}/contador/`);
        if (cancelado) return;
        setData(res);
      } catch (e) {
        console.error("Error cargando contador:", e);
      }
    };

    cargar();
    poll = setInterval(cargar, 15000);

    const onVis = () => {
      if (document.visibilityState === "visible") cargar();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelado = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tareaId]);

  const extraFallback = (data as any)?.segundos_extra ?? 0;
  if (data && data.tiempo_tomado_segundos !== null) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>Tiempo tomado: {formatearTiempo(data.tiempo_tomado_segundos)}<BadgeExtra segundos={extraFallback} /></span>;
  if (data && data.pausado) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>En pausa<BadgeExtra segundos={extraFallback} /></span>;
  if (!data) return <span>Calculando...</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>{formatearTiempo(data.segundos_restantes)}<BadgeExtra segundos={extraFallback} /></span>;
}
