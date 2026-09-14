"use client";

import { formatearTiempo, segundosLaboralesEntre } from "@/lib/tiempoLaboral";
import { useContador } from "./ContadoresProvider";
import { useEffect, useState, useRef } from "react";
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
  incluye_sabado?: boolean;
  servidor_ahora: string;
}

type Snap = { raw: ContadorResponseFallback; serverAhora: Date };

function BadgeExtra({ segundos }: { segundos: number }) {
  if (!segundos || segundos <= 0) return null;
  return <span style={{ marginLeft: 6, background: "#ede9fe", color: "#5b21b6", border: "1px solid #ddd6fe", padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>+{formatearTiempo(segundos)} anticipado</span>;
}

export default function TaskCountdown({ tareaId, incluyeSabado }: TaskCountdownProps) {
  const ctxData = useContador(tareaId);
  const conProvider = ctxData !== undefined;

  // Fallback aislado (hooks siempre declarados): snapshot + interpolación sin drift
  const [snapshot, setSnapshot] = useState<Snap | null>(null);
  const [displaySec, setDisplaySec] = useState<number | null>(null);
  const snapshotRef = useRef<Snap | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (conProvider) return;
    let cancelado = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    let lastFetch = 0;

    const cargar = async () => {
      if (Date.now() - lastFetch < 2000) return;
      lastFetch = Date.now();
      try {
        const data = await apiFetch<ContadorResponseFallback>(`/api/tasks/tasks/${tareaId}/contador/`);
        if (cancelado) return;
        const snap: Snap = { raw: data, serverAhora: data.servidor_ahora ? new Date(data.servidor_ahora) : new Date() };
        setSnapshot(snap);
        if (!snap.raw.activo || snap.raw.pausado || snap.raw.tiempo_tomado_segundos !== null) {
          setDisplaySec(snap.raw.segundos_restantes);
        } else {
          const incluye = typeof incluyeSabado === "boolean" ? incluyeSabado : !!snap.raw.incluye_sabado;
          const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date(), incluye);
          setDisplaySec(Math.max(0, snap.raw.segundos_restantes - elapsed));
        }
      } catch (e) {
        console.error("Error cargando contador:", e);
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

    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > 5000) cargar();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelado = true;
      if (poll) clearInterval(poll);
      if (tick) clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tareaId, incluyeSabado, conProvider]);

  if (conProvider) {
    if (ctxData === null) return <span>Calculando...</span>;
    const extra = ctxData.segundos_extra ?? 0;
    if (ctxData.tiempo_tomado_segundos !== null) {
      return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>Tiempo tomado: {formatearTiempo(ctxData.tiempo_tomado_segundos)}<BadgeExtra segundos={extra} /></span>;
    }
    if (ctxData.pausado) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>En pausa<BadgeExtra segundos={extra} /></span>;
    return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>{formatearTiempo(ctxData.segundos_restantes)}<BadgeExtra segundos={extra} /></span>;
  }

  const extraFallback = snapshot?.raw.segundos_extra ?? 0;
  if (snapshot && snapshot.raw.tiempo_tomado_segundos !== null) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>Tiempo tomado: {formatearTiempo(snapshot.raw.tiempo_tomado_segundos)}<BadgeExtra segundos={extraFallback} /></span>;
  if (snapshot && snapshot.raw.pausado) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>En pausa<BadgeExtra segundos={extraFallback} /></span>;
  if (displaySec === null) return <span>Calculando...</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>{formatearTiempo(displaySec)}<BadgeExtra segundos={extraFallback} /></span>;
}
