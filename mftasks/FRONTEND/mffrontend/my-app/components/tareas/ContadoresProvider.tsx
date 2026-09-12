"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface ContadorResponse {
  activo: boolean;
  pausado: boolean;
  finalizado: boolean;
  segundos_restantes: number;
  tiempo_tomado_segundos: number | null;
  tiempo_planificado_segundos?: number | null;
  tiempo_planificado_efectivo_segundos?: number | null;
  tiempo_planificado_original_segundos?: number | null;
  segundos_extra?: number | null;
  inicio_anticipado?: boolean;
  fecha_inicio_efectiva?: string | null;
  fecha_inicio_programada?: string | null;
  incluye_sabado?: boolean;
  fecha_entrega_aproximada: string | null;
  fecha_inicio?: string | null;
  fecha_solucion?: string | null;
  servidor_ahora: string;
}

const ContadoresContext = createContext<Map<number, ContadorResponse | null> | null>(null);
const POLL_MS = 15000;

export function useContador(tareaId: number): ContadorResponse | null | undefined {
  const ctx = useContext(ContadoresContext);
  if (!ctx) return undefined;
  return ctx.get(tareaId) ?? null;
}

export function ContadoresProvider({
  ids,
  children,
}: {
  ids: number[];
  children: React.ReactNode;
}) {
  const [displayMap, setDisplayMap] = useState<Map<number, ContadorResponse | null>>(new Map());
  const idsRef = useRef<number[]>(ids);
  idsRef.current = ids;
  const lastFetchRef = useRef<number>(0);

  const cargarBatch = useCallback(async () => {
    if (idsRef.current.length === 0) {
      setDisplayMap(new Map());
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
    setDisplayMap((prev) => {
      const next = new Map<number, ContadorResponse | null>();
      for (const [id, data] of results) {
        next.set(id, data);
      }
      // limpiar ids que ya no están
      for (const id of idsRef.current) if (!next.has(id)) next.set(id, null);
      // si prev tenía ids que ya no están, no los arrastramos (next ya es solo actuales)
      return next;
    });
    lastFetchRef.current = Date.now();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const doCargar = async () => {
      if (cancelled) return;
      if (Date.now() - lastFetchRef.current < 2000) return;
      await cargarBatch();
    };

    // inicializar mapa con null para evitar flash inconsistente
    setDisplayMap((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const id of ids) if (!next.has(id)) { next.set(id, null); changed = true; }
      for (const k of Array.from(next.keys())) if (!ids.includes(k)) { next.delete(k); changed = true; }
      return changed ? next : prev;
    });

    doCargar();
    poll = setInterval(doCargar, POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        doCargar();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ids, cargarBatch]);

  return <ContadoresContext.Provider value={displayMap}>{children}</ContadoresContext.Provider>;
}
