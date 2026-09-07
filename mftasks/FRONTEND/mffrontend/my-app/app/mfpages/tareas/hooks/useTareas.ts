"use client";

import { useCallback, useEffect, useState } from "react";
import { Task } from "@/lib/types";
import { fetchTareas } from "@/lib/services/tareasService";

export function useTareas() {
  const [tareas, setTareas] = useState<Task[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(
    async (searchOverride?: string) => {
      const q = typeof searchOverride === "string" ? searchOverride : busqueda;
      try {
        const data = await fetchTareas(q);
        setError(null);
        setTareas(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setCargando(false);
      }
    },
    [busqueda]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { tareas, cargando, error, busqueda, setBusqueda, cargar, setTareas, setError };
}
