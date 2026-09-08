"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { estaEnJornada } from "@/lib/tiempoLaboral";

export interface ContadorResponse {
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

type ContadoresMap = Map<number, ContadorResponse | null>;

const ContadoresContext = createContext<ContadoresMap | null>(null);

export function useContador(tareaId: number): ContadorResponse | null | undefined {
  const ctx = useContext(ContadoresContext);
  if (!ctx) return undefined; // no provider -> fallback a undefined
  return ctx.get(tareaId) ?? null; // null = cargando aún
}

export function ContadoresProvider({
  ids,
  children,
}: {
  ids: number[];
  children: React.ReactNode;
}) {
  const [map, setMap] = useState<ContadoresMap>(new Map());
  const idsRef = useRef<number[]>(ids);
  idsRef.current = ids;

  const cargarBatch = useCallback(async () => {
    if (idsRef.current.length === 0) {
      setMap(new Map());
      return;
    }
    const results = await Promise.all(
      idsRef.current.map(async (id) => {
        try {
          const data = await apiFetch<ContadorResponse>(`/api/tasks/tasks/${id}/contador/`);
          return [id, data] as const;
        } catch {
          return [id, null] as const;
        }
      })
    );
    setMap((prev) => {
      const next = new Map(prev);
      for (const [id, data] of results) {
        // solo actualizar si el id sigue visible (evita race al cambiar página)
        if (idsRef.current.includes(id)) {
          next.set(id, data);
        }
      }
      // limpiar ids que ya no están visibles
      for (const k of Array.from(next.keys())) {
        if (!idsRef.current.includes(k)) next.delete(k);
      }
      return next;
    });
  }, []);

  // poll inicial + cada 30s + visibilitychange
  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const doCargar = async () => {
      if (cancelled) return;
      await cargarBatch();
    };

    // reset map al cambiar ids (para mostrar "Calculando..." en nuevos)
    setMap((prev) => {
      const n = new Map<number, ContadorResponse | null>();
      for (const id of ids) {
        // preservar si ya existe, sino null (cargando)
        n.set(id, prev.get(id) ?? null);
      }
      return n;
    });

    doCargar();
    poll = setInterval(doCargar, 30000);

    const onVis = () => {
      if (document.visibilityState === "visible") doCargar();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ids, cargarBatch]);

  // 1 tick global 1s -> decrementa todos los activos en jornada
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      // 1 cálculo de estaEnJornada por incluye_sabado distinto (true/false) -> cache
      const jornadaCache = new Map<boolean, boolean>();
      const getJornada = (incluye: boolean) => {
        if (!jornadaCache.has(incluye)) jornadaCache.set(incluye, estaEnJornada(now, incluye));
        return jornadaCache.get(incluye)!;
      };

      setMap((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, data] of prev.entries()) {
          if (!data) continue;
          if (!data.activo || data.pausado) continue;
          if (data.tiempo_tomado_segundos !== null) continue; // ya finalizado
          const incluye = !!data.incluye_sabado;
          if (!getJornada(incluye)) continue;
          if (data.segundos_restantes <= 0) continue;
          const updated: ContadorResponse = { ...data, segundos_restantes: Math.max(0, data.segundos_restantes - 1) };
          next.set(id, updated);
          changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  return <ContadoresContext.Provider value={map}>{children}</ContadoresContext.Provider>;
}
