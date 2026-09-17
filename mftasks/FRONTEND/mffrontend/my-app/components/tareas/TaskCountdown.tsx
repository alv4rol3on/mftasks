"use client";

import { formatearTiempo, segundosLaboralesEntre, colorContador } from "@/lib/tiempoLaboral";
import { useContador } from "./ContadoresProvider";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

interface TaskCountdownProps {
  tareaId: number;
}

interface ContadorResponseFallback {
  activo: boolean;
  pausado: boolean;
  finalizado: boolean;
  segundos_restantes: number;
  con_retraso?: boolean;
  segundos_retraso?: number | null;
  tiempo_tomado_segundos: number | null;
  segundos_extra?: number | null;
  tiempo_planificado_segundos?: number | null;
  tiempo_planificado_efectivo_segundos?: number | null;
  incluye_sabado?: boolean;
  servidor_ahora: string;
}

type Snap = { raw: ContadorResponseFallback; serverAhora: Date };

const COLOR_RETRASO = "#dc2626";

function BadgeExtra({ segundos }: { segundos: number }) {
  if (!segundos || segundos <= 0) return null;
  return <span style={{ marginLeft: 6, background: "#ede9fe", color: "#5b21b6", border: "1px solid #ddd6fe", padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>+{formatearTiempo(segundos)} anticipado</span>;
}

function TextoExcedido({ segundos, extra }: { segundos: number; extra: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4, color: COLOR_RETRASO, fontWeight: 700 }}>
      ⏱ +{formatearTiempo(segundos)} excedido<BadgeExtra segundos={extra} />
    </span>
  );
}

export default function TaskCountdown({ tareaId }: TaskCountdownProps) {
  const ctxData = useContador(tareaId);
  const conProvider = ctxData !== undefined;

  // Fallback aislado (hooks siempre declarados): snapshot + interpolación sin drift.
  // displaySec es "firmado": positivo = restante, negativo = excedido.
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

    const baseFirmada = (raw: ContadorResponseFallback) =>
      raw.con_retraso ? -(raw.segundos_retraso ?? 0) : raw.segundos_restantes;

    const cargar = async () => {
      if (Date.now() - lastFetch < 2000) return;
      lastFetch = Date.now();
      try {
        const data = await apiFetch<ContadorResponseFallback>(`/api/tasks/tasks/${tareaId}/contador/`);
        if (cancelado) return;
        const snap: Snap = { raw: data, serverAhora: data.servidor_ahora ? new Date(data.servidor_ahora) : new Date() };
        setSnapshot(snap);
        if (!snap.raw.activo || snap.raw.pausado || snap.raw.tiempo_tomado_segundos !== null) {
          setDisplaySec(baseFirmada(snap.raw));
        } else {
          const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date());
          setDisplaySec(baseFirmada(snap.raw) - elapsed);
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
      const elapsed = segundosLaboralesEntre(snap.serverAhora, new Date());
      setDisplaySec(baseFirmada(snap.raw) - elapsed);
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
  }, [tareaId, conProvider]);

  if (conProvider) {
    if (ctxData === null) return <span>Calculando...</span>;
    const extra = ctxData.segundos_extra ?? 0;
    if (ctxData.tiempo_tomado_segundos !== null) {
      return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>Tiempo tomado: {formatearTiempo(ctxData.tiempo_tomado_segundos)}<BadgeExtra segundos={extra} /></span>;
    }
    if (ctxData.con_retraso) {
      return <TextoExcedido segundos={ctxData.segundos_retraso ?? 0} extra={extra} />;
    }
    if (ctxData.pausado) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>En pausa<BadgeExtra segundos={extra} /></span>;
    const planificadoProvider =
      ctxData.tiempo_planificado_efectivo_segundos ??
      ctxData.tiempo_planificado_segundos ??
      null;
    const colorProvider = colorContador(ctxData.segundos_restantes, planificadoProvider);
    return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4, color: colorProvider ?? undefined }}>{formatearTiempo(ctxData.segundos_restantes)}<BadgeExtra segundos={extra} /></span>;
  }

  const extraFallback = snapshot?.raw.segundos_extra ?? 0;
  if (snapshot && snapshot.raw.tiempo_tomado_segundos !== null) return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>Tiempo tomado: {formatearTiempo(snapshot.raw.tiempo_tomado_segundos)}<BadgeExtra segundos={extraFallback} /></span>;
  if (snapshot && snapshot.raw.pausado) {
    if (displaySec !== null && displaySec < 0) return <TextoExcedido segundos={-displaySec} extra={extraFallback} />;
    return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>En pausa<BadgeExtra segundos={extraFallback} /></span>;
  }
  if (displaySec === null) return <span>Calculando...</span>;
  if (displaySec < 0) return <TextoExcedido segundos={-displaySec} extra={extraFallback} />;
  const planificadoFallback = snapshot?.raw.tiempo_planificado_efectivo_segundos ?? snapshot?.raw.tiempo_planificado_segundos ?? null;
  const colorFallback = colorContador(displaySec, planificadoFallback);
  return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4, color: colorFallback ?? undefined }}>{formatearTiempo(displaySec)}<BadgeExtra segundos={extraFallback} /></span>;
}
