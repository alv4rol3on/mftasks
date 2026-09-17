"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Task } from "@/lib/types";
import { fetchTareas, type FiltrosTareas } from "@/lib/services/tareasService";

const DEBOUNCE_MS = 350;

export function useTareas(filtros: FiltrosTareas = {}) {
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce de los filtros: evita una petición por cada tecla.
  const filtrosKey = JSON.stringify(filtros);
  const [debouncedKey, setDebouncedKey] = useState(filtrosKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKey(filtrosKey), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filtrosKey]);

  const debouncedFiltros = useMemo(
    () => JSON.parse(debouncedKey) as FiltrosTareas,
    [debouncedKey]
  );

  // Descarta respuestas de peticiones antiguas que lleguen fuera de orden.
  const reqId = useRef(0);

  const cargar = useCallback(
    async (overrides?: FiltrosTareas) => {
      const id = ++reqId.current;
      try {
        const data = await fetchTareas({ ...debouncedFiltros, ...overrides });
        if (id !== reqId.current) return;
        setError(null);
        setTareas(data);
      } catch (e) {
        if (id !== reqId.current) return;
        setError((e as Error).message);
      } finally {
        if (id === reqId.current) setCargando(false);
      }
    },
    [debouncedFiltros]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { tareas, cargando, error, cargar, setTareas, setError };
}
