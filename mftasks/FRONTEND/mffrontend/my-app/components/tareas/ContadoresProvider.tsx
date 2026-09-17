"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { segundosLaboralesEntre } from "@/lib/tiempoLaboral";

export interface ContadorResponse {
  activo: boolean;
  pausado: boolean;
  finalizado: boolean;
  segundos_restantes: number;
  con_retraso?: boolean;
  segundos_retraso?: number | null;
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

type Snapshot = { raw: ContadorResponse; serverAhora: Date };

const ContadoresContext = createContext<Map<number, ContadorResponse | null> | null>(null);
const POLL_MS = 30000;
const VIS_DEBOUNCE_MS = 5000;
const SNAP_STORAGE_KEY = "mftasks-snapMap-v1";

/**
 * Interpola el restante usando solo segundos laborales entre el snapshot y ahora.
 * Fuera de jornada (noche, domingo, sábado después de 13:00) no decrementa.
 */
function interpolate(snapshot: Snapshot, now: Date): ContadorResponse {
  const { raw } = snapshot;
  if (!raw.activo || raw.pausado || raw.tiempo_tomado_segundos !== null) return raw;
  const elapsed = segundosLaboralesEntre(snapshot.serverAhora, now);
  // Firmado: positivo = restante, negativo = excedido (continúa más allá de 0).
  const base = raw.con_retraso ? -(raw.segundos_retraso ?? 0) : raw.segundos_restantes;
  const signed = base - elapsed;
  if (signed >= 0) {
    if (signed === raw.segundos_restantes && !raw.con_retraso) return raw;
    return { ...raw, segundos_restantes: signed, con_retraso: false, segundos_retraso: 0 };
  }
  const retraso = -signed;
  if (raw.con_retraso && retraso === (raw.segundos_retraso ?? 0)) return raw;
  return { ...raw, segundos_restantes: 0, con_retraso: true, segundos_retraso: retraso };
}

function hidratar(): Map<number, Snapshot | null> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = sessionStorage.getItem(SNAP_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed: { id: number; raw: ContadorResponse; serverAhora: string }[] = JSON.parse(raw);
    const m = new Map<number, Snapshot | null>();
    for (const p of parsed) m.set(p.id, { raw: p.raw, serverAhora: new Date(p.serverAhora) });
    return m;
  } catch {
    return new Map();
  }
}

function persistir(snapMap: Map<number, Snapshot | null>) {
  try {
    const arr = Array.from(snapMap.entries())
      .filter(([, v]) => v !== null)
      .map(([id, v]) => {
        const snap = v as Snapshot;
        return { id, raw: snap.raw, serverAhora: snap.serverAhora.toISOString() };
      });
    sessionStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // sessionStorage puede no estar disponible
  }
}

export function useContador(tareaId: number): ContadorResponse | null | undefined {
  const ctx = useContext(ContadoresContext);
  if (!ctx) return undefined;
  return ctx.get(tareaId) ?? null;
}

export function ContadoresProvider({
  ids,
  refreshKey,
  children,
}: {
  ids: number[];
  refreshKey?: string;
  children: React.ReactNode;
}) {
  // Snapshot autoritativo del servidor (persistido para sobrevivir remounts/cambio de pestaña)
  const [snapMap, setSnapMap] = useState<Map<number, Snapshot | null>>(() => hidratar());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const idsRef = useRef<number[]>(ids);
  const snapMapRef = useRef<Map<number, Snapshot | null>>(snapMap);
  const lastFetchRef = useRef<number>(0);
  const primeraRefreshRef = useRef<boolean>(true);

  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  useEffect(() => {
    snapMapRef.current = snapMap;
    persistir(snapMap);
  }, [snapMap]);

  const cargarBatch = useCallback(async () => {
    if (idsRef.current.length === 0) {
      setSnapMap(new Map());
      return;
    }
    lastFetchRef.current = Date.now();
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
        if (data === null) {
          // conservar snapshot previo si existe para no parpadear
          if (!next.has(id)) next.set(id, null);
        } else {
          next.set(id, {
            raw: data,
            serverAhora: data.servidor_ahora ? new Date(data.servidor_ahora) : new Date(),
          });
        }
      }
      for (const k of Array.from(next.keys())) if (!idsRef.current.includes(k)) next.delete(k);
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

    const hayFaltantes = ids.some((id) => {
      const s = snapMapRef.current.get(id);
      return !s;
    });
    if (hayFaltantes || snapMapRef.current.size === 0) doCargar();
    poll = setInterval(doCargar, POLL_MS);

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchRef.current < VIS_DEBOUNCE_MS) return;
      doCargar();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ids, cargarBatch]);

  // Refresco inmediato cuando cambian los datos (pausar/reanudar/completar, etc.)
  useEffect(() => {
    if (primeraRefreshRef.current) {
      primeraRefreshRef.current = false;
      return;
    }
    lastFetchRef.current = 0;
    void cargarBatch();
  }, [refreshKey, cargarBatch]);

  // Tick por segundo: la interpolación se congela fuera de jornada laboral.
  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Valor mostrado = snapshot + segundos laborales transcurridos.
  const displayMap = useMemo(() => {
    const now = new Date(nowTick);
    const next = new Map<number, ContadorResponse | null>();
    for (const id of ids) {
      const s = snapMap.get(id);
      next.set(id, s ? interpolate(s, now) : null);
    }
    return next;
  }, [snapMap, nowTick, ids]);

  return <ContadoresContext.Provider value={displayMap}>{children}</ContadoresContext.Provider>;
}
