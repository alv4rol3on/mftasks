"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { apiBaseUrl } from "@/lib/authConfig";
import { segundosLaboralesEntre } from "@/lib/tiempoLaboral";

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

type Snapshot = {
  raw: ContadorResponse;
  serverAhora: Date;
};

type ContadoresMap = Map<number, Snapshot | null>;

const ContadoresContext = createContext<Map<number, ContadorResponse | null> | null>(null);
const POLL_MS = 30000;
const VIS_DEBOUNCE_MS = 5000;
const SNAP_STORAGE_KEY = "mftasks-snapMap-v1";
const BC_NAME = "mftasks-contadores";

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
  const [snapMap, setSnapMap] = useState<ContadoresMap>(() => {
    // hidratar desde sessionStorage para evitar flash Calculando... al cambio de pestaña
    if (typeof window === "undefined") return new Map();
    try {
      const raw = sessionStorage.getItem(SNAP_STORAGE_KEY);
      if (!raw) return new Map();
      const parsed: { id: number; raw: ContadorResponse; serverAhora: string }[] = JSON.parse(raw);
      const m = new Map<number, Snapshot | null>();
      for (const p of parsed) m.set(p.id, { raw: p.raw, serverAhora: new Date(p.serverAhora) });
      return m;
    } catch { return new Map(); }
  });
  const [displayMap, setDisplayMap] = useState<Map<number, ContadorResponse | null>>(new Map());
  const idsRef = useRef<number[]>(ids);
  idsRef.current = ids;
  const snapMapRef = useRef<ContadoresMap>(snapMap);
  snapMapRef.current = snapMap;
  const lastFetchRef = useRef<number>(0);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isLeaderRef = useRef<boolean>(true);

  const aplicarSnapBatch = useCallback((updates: { id: number; data: ContadorResponse }[]) => {
    setSnapMap((prev) => {
      const next = new Map(prev);
      for (const { id, data } of updates) {
        if (!idsRef.current.includes(id)) continue;
        const serverAhora = data.servidor_ahora ? new Date(data.servidor_ahora) : new Date();
        next.set(id, { raw: data, serverAhora });
      }
      for (const k of Array.from(next.keys())) if (!idsRef.current.includes(k)) next.delete(k);
      return next;
    });
  }, []);

  const broadcastSnaps = useCallback((updates: { id: number; data: ContadorResponse }[]) => {
    try {
      if (bcRef.current) bcRef.current.postMessage({ type: "snap", updates, ts: Date.now() });
      // persist for tab-restore
      const toPersist = updates.map(({ id, data }) => ({ id, raw: data, serverAhora: data.servidor_ahora }));
      sessionStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(toPersist));
    } catch {}
  }, []);

  const cargarBatch = useCallback(async () => {
    if (idsRef.current.length === 0) {
      setSnapMap(new Map());
      return;
    }
    // solo lider fetchea si hay BroadcastChannel activo y no es lider -> skip
    if (bcRef.current && !isLeaderRef.current) return;
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
    const updates: { id: number; data: ContadorResponse }[] = [];
    for (const [id, data] of results) if (data !== null) updates.push({ id, data });
    if (updates.length) {
      aplicarSnapBatch(updates);
      broadcastSnaps(updates);
    } else {
      setSnapMap((prev) => {
        const next = new Map(prev);
        for (const k of Array.from(next.keys())) if (!idsRef.current.includes(k)) next.delete(k);
        return next;
      });
    }
  }, [aplicarSnapBatch, broadcastSnaps]);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    // init BroadcastChannel leader election simple: primer tab es lider, followers escuchan
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(BC_NAME);
        bcRef.current = bc;
        const myId = Math.random().toString(36).slice(2);
        let leaderId: string | null = null;
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (msg?.type === "heartbeat" && msg.id) {
            if (!leaderId || msg.ts > (leaderId as any)) { /* noop */ }
            if (!leaderId) leaderId = msg.id;
            isLeaderRef.current = leaderId === myId;
          }
          if (msg?.type === "snap" && Array.isArray(msg.updates)) {
            aplicarSnapBatch(msg.updates);
          }
        };
        // announce
        bc.postMessage({ type: "heartbeat", id: myId, ts: Date.now() });
        const hb = setInterval(() => { if (bcRef.current) bcRef.current.postMessage({ type: "heartbeat", id: myId, ts: Date.now() }); }, 4000);
        // decide leader after 800ms: if no other, become leader
        setTimeout(() => { if (!leaderId) { leaderId = myId; isLeaderRef.current = true; } }, 800);
        // cleanup hb on unmount handled below
        (bcRef as any)._hb = hb;
        // follower sync request
        bc.postMessage({ type: "sync_request", from: myId });
      }
    } catch {}
    // WS via Valkey/Channels (opcional, fallback a poll si no disponible)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access") : null;
      const wsBase = apiBaseUrl.replace(/^http/, "ws");
      const wsUrl = token ? `${wsBase}/ws/contadores/?token=${encodeURIComponent(token)}` : `${wsBase}/ws/contadores/`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        try { ws.send(JSON.stringify({ ids: idsRef.current })); } catch {}
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === "contador" && msg.data) {
            const tid = Number(msg.tarea_id);
            if (tid) { aplicarSnapBatch([{ id: tid, data: msg.data as ContadorResponse }]); broadcastSnaps([{ id: tid, data: msg.data as ContadorResponse }]); }
          }
        } catch {}
      };
      ws.onerror = () => { try { ws.close(); } catch {} wsRef.current = null; };
      ws.onclose = () => { wsRef.current = null; };
    } catch { wsRef.current = null; }

    const doCargar = async () => {
      if (cancelled) return;
      if (Date.now() - lastFetchRef.current < 2000) return;
      await cargarBatch();
      // ws sync ids if connected
      try { if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ ids: idsRef.current })); } catch {}
    };
    setSnapMap((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const id of ids) if (!next.has(id)) { next.set(id, null); changed = true; }
      for (const k of Array.from(next.keys())) if (!ids.includes(k)) { next.delete(k); changed = true; }
      return changed ? next : prev;
    });
    const hasNull = ids.some((id) => !snapMapRef.current.has(id) || snapMapRef.current.get(id) === null);
    if (hasNull || snapMapRef.current.size === 0) doCargar();
    poll = setInterval(doCargar, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        // hidratar desde storage para evitar flash
        try {
          const raw = sessionStorage.getItem(SNAP_STORAGE_KEY);
          if (raw) {
            const parsed: { id: number; raw: ContadorResponse; serverAhora: string }[] = JSON.parse(raw);
            const ups = parsed.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, data: p.raw }));
            if (ups.length) aplicarSnapBatch(ups);
          }
        } catch {}
        if (Date.now() - lastFetchRef.current < VIS_DEBOUNCE_MS) return;
        doCargar();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      try { if (bcRef.current) { const hb = (bcRef.current as any)._hb; if (hb) clearInterval(hb); bcRef.current.close(); } } catch {}
      bcRef.current = null;
      try { if (wsRef.current) wsRef.current.close(); } catch {}
      wsRef.current = null;
    };
  }, [ids, cargarBatch, aplicarSnapBatch, broadcastSnaps]);

  // tick interpolado sin mutar snapshot, pausado si tab oculta para ahorrar + evitar reset
  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
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

  // sync display on snapMap change (fetch) + persist
  useEffect(() => {
    const now = new Date();
    const next = new Map<number, ContadorResponse | null>();
    for (const [id, s] of snapMap.entries()) {
      if (s === null) next.set(id, null);
      else next.set(id, interpolate(s, now));
    }
    for (const id of idsRef.current) if (!next.has(id)) next.set(id, null);
    setDisplayMap(next);
    try {
      const persist = Array.from(snapMap.entries()).filter(([, v]) => v !== null).map(([id, v]) => ({ id, raw: (v as any).raw, serverAhora: (v as any).serverAhora.toISOString() }));
      if (persist.length) sessionStorage.setItem(SNAP_STORAGE_KEY, JSON.stringify(persist));
    } catch {}
  }, [snapMap]);

  return <ContadoresContext.Provider value={displayMap}>{children}</ContadoresContext.Provider>;
}
