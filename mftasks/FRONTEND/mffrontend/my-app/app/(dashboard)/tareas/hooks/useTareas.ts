"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Task } from "@/lib/types";
import { fetchTareas, type FiltrosTareas } from "@/lib/services/tareasService";

const DEBOUNCE_MS = 350;

export function useTareas(
  filtros: FiltrosTareas = {},
  enabled = true
) {
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!enabled) return;
    // Esperar a que el debounce alcance los filtros actuales para no
    // disparar una petición con el estado anterior (p. ej. antes de hidratar).
    if (debouncedKey !== filtrosKey) return;
    void cargar();
  }, [cargar, enabled, debouncedKey, filtrosKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { tareas, cargando, error, cargar, setTareas, setError };
}
