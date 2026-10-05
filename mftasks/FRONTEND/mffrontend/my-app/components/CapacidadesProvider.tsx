"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getUsuarioActual } from "@/lib/auth";
import type { EquipoInfo } from "@/lib/types";
import { calcularCaps, type Caps } from "@/lib/capacidades";

type RespuestaEquipos = EquipoInfo[] | { results: EquipoInfo[] };

function extraerEquipos(data: RespuestaEquipos): EquipoInfo[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

type CapacidadesContexto = {
  caps: Caps;
  cargando: boolean;
  autenticado: boolean;
};

const CapacidadesContext = createContext<CapacidadesContexto | null>(null);

export default function CapacidadesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [equipos, setEquipos] = useState<EquipoInfo[] | null>(null);
  const [cargando, setCargando] = useState(true);

  // La sesión vive en localStorage; se evalúa en cada render.
  const autenticado = Boolean(getUsuarioActual());

  useEffect(() => {
    if (!getUsuarioActual()) return;

    let cancel = false;
    apiFetch<RespuestaEquipos>("/api/usuarios/equipos/")
      .then((data) => {
        if (!cancel) setEquipos(extraerEquipos(data));
      })
      .catch(() => {
        if (!cancel) setEquipos([]);
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });

    return () => {
      cancel = true;
    };
  }, [pathname]);

  const caps = useMemo(
    () => calcularCaps(getUsuarioActual(), equipos),
    [equipos]
  );

  const valor = useMemo(
    () => ({ caps, cargando, autenticado }),
    [caps, cargando, autenticado]
  );

  return (
    <CapacidadesContext.Provider value={valor}>
      {children}
    </CapacidadesContext.Provider>
  );
}

export function useCapacidades(): CapacidadesContexto {
  const ctx = useContext(CapacidadesContext);
  if (!ctx) {
    throw new Error("useCapacidades debe usarse dentro de CapacidadesProvider");
  }
  return ctx;
}
