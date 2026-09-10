"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { segundosLaboralesEntre } from "@/lib/tiempoLaboral";

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

type Snapshot = {
  raw: ContadorResponse;
  serverAhora: Date;
};

type ContadoresMap = Map<number, Snapshot | null>;

const ContadoresContext = createContext<Map<number, ContadorResponse | null> | null>(null);
const POLL_MS = 30000;
const VIS_DEBOUNCE_MS = 5000;

function interpolate(snapshot: Snapshot, now: Date): ContadorResponse {
  const { raw } = snapshot;
  if (!raw.activo || raw.pausado || raw.tiempo_tomado_segundos !== null) return raw;
  if (raw.segundos_restantes <= 0) return raw;
  const incluye = !!raw.incluye_sabado;
  const elapsed = segundosLaboralesEntre(snapshot.serverAhora, now, incluye);
  const restante = Math.max(0, raw.segundos_restantes - elapsed);
  if (restante === raw.segundos_restantes) return raw;
  return { ...raw, segundos_restantes: restante };
}

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
  const [snapMap, setSnapMap] = useState<ContadoresMap>(new Map());
  const [displayMap, setDisplayMap] = useState<Map<number, ContadorResponse | null>>(new Map());
  const idsRef = useRef<number[]>(ids);
  idsRef.current = ids;
  const snapMapRef = useRef<ContadoresMap>(snapMap);
  snapMapRef.current = snapMap;
  const lastFetchRef = useRef<number>(0);

  const cargarBatch = useCallback(async () => {
    if (idsRef.current.length === 0) {
      setSnapMap(new Map());
      return;
    }
    const nowFetch = Date.now();
    lastFetchRef.current = nowFetch;
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
    setSnapMap((prev) => {
      const next = new Map(prev);
      for (const [id, data] of results) {
        if (!idsRef.current.includes(id)) continue;
        if (data === null) continue; // preserve on error
        const serverAhora = data.servidor_ahora ? new Date(data.servidor_ahora) : new Date();
        next.set(id, { raw: data, serverAhora });
      }
      for (const k of Array.from(next.keys())) {
        if (!idsRef.current.includes(k)) next.delete(k);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const doCargar = async () => {
      if (cancelled) return;
      if (Date.now() - lastFetchRef.current < 2000) return;
      await cargarBatch();
    };
    setSnapMap((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.set(id, null);
          changed = true;
        }
      }
      for (const k of Array.from(next.keys())) {
        if (!ids.includes(k)) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // schedule initial if needed
    const hasNull = ids.some((id) => !snapMapRef.current.has(id) || snapMapRef.current.get(id) === null);
    if (hasNull || snapMapRef.current.size === 0) doCargar();
    poll = setInterval(doCargar, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastFetchRef.current < VIS_DEBOUNCE_MS) return;
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

  // tick interpolado sin mutar snapshot
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      const snap = snapMapRef.current;
      setDisplayMap(() => {
        const next = new Map<number, ContadorResponse | null>();
        for (const [id, s] of snap.entries()) {
          if (s === null) next.set(id, null);
          else next.set(id, interpolate(s, now));
        }
        for (const id of idsRef.current) if (!next.has(id)) next.set(id, null);
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // sync display on snapMap change (fetch)
  useEffect(() => {
    const now = new Date();
    const next = new Map<number, ContadorResponse | null>();
    for (const [id, s] of snapMap.entries()) {
      if (s === null) next.set(id, null);
      else next.set(id, interpolate(s, now));
    }
    for (const id of idsRef.current) if (!next.has(id)) next.set(id, null);
    setDisplayMap(next);
  }, [snapMap]);

  return <ContadoresContext.Provider value={displayMap}>{children}</ContadoresContext.Provider>;
}
