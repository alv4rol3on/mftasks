"use client";

import { formatearTiempo } from "@/lib/tiempoLaboral";
import { useContador } from "./ContadoresProvider";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { estaEnJornada } from "@/lib/tiempoLaboral";

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
  tiempo_planificado_segundos?: number | null;
  incluye_sabado?: boolean;
  fecha_entrega_aproximada: string | null;
  fecha_inicio?: string | null;
  fecha_solucion?: string | null;
  servidor_ahora: string;
}

export default function TaskCountdown({ tareaId, incluyeSabado }: TaskCountdownProps) {
  const ctxData = useContador(tareaId);

  // Si hay provider (ctxData !== undefined), usar modo centralizado 1 poll/1 tick global
  if (ctxData !== undefined) {
    if (ctxData === null) return <span>Calculando...</span>;
    if (ctxData.tiempo_tomado_segundos !== null) {
      return <span>Tiempo tomado: {formatearTiempo(ctxData.tiempo_tomado_segundos)}</span>;
    }
    if (ctxData.pausado) return <span>En pausa</span>;
    // segundos_restantes ya viene decrementado por tick global
    return <span>{formatearTiempo(ctxData.segundos_restantes)}</span>;
  }

  // Fallback: sin provider (uso aislado) -> comportamiento anterior por fila
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
        const data = await apiFetch<ContadorResponseFallback>(`/api/tasks/tasks/${tareaId}/contador/`);
        if (cancelado) return;
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
    poll = setInterval(cargar, 30000);
    tick = setInterval(() => {
      if (!activoRef.current || pausadoRef.current) return;
      if (!estaEnJornada(new Date(), incluyeRef.current)) return;
      setSegundos((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
    }, 1000);

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

  if (tiempoTomado !== null) return <span>Tiempo tomado: {formatearTiempo(tiempoTomado)}</span>;
  if (pausado) return <span>En pausa</span>;
  if (segundos === null) return <span>Calculando...</span>;
  if (!activo && segundos === 0) return <span>{formatearTiempo(segundos)}</span>;
  return <span>{formatearTiempo(segundos)}</span>;
}
