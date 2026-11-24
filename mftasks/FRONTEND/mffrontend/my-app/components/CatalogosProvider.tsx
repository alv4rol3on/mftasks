"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchPrioridades,
  fetchTiposSolicitud,
} from "@/lib/services/catalogosService";
import type { PrioridadCatalogo, TipoSolicitudCatalogo } from "@/lib/types";

const TIPOS_FALLBACK: TipoSolicitudCatalogo[] = [
  { codigo: "NUEVA_FUNCIONALIDAD", nombre: "Nueva funcionalidad", orden: 1, requiere_detalle: false, activo: true },
  { codigo: "REPORTE", nombre: "Creación de reporte", orden: 2, requiere_detalle: false, activo: true },
  { codigo: "CORRECCION_ERROR", nombre: "Corrección de error", orden: 3, requiere_detalle: false, activo: true },
  { codigo: "CREACION_BI", nombre: "Creación de BI", orden: 4, requiere_detalle: false, activo: true },
  { codigo: "OTROS", nombre: "Otros", orden: 5, requiere_detalle: true, activo: true },
];

const PRIORIDADES_FALLBACK: PrioridadCatalogo[] = [
  { codigo: "BAJA", nombre: "Baja", orden: 1, color: "", activo: true },
  { codigo: "MEDIA", nombre: "Media", orden: 2, color: "", activo: true },
  { codigo: "ALTA", nombre: "Alta", orden: 3, color: "", activo: true },
  { codigo: "URGENTE", nombre: "Urgente", orden: 4, color: "", activo: true },
];

type CatalogosContexto = {
  tiposSolicitud: TipoSolicitudCatalogo[];
  prioridades: PrioridadCatalogo[];
  cargando: boolean;
  recargar: () => Promise<void>;
  tipoSolicitudPorCodigo: (codigo: string) => TipoSolicitudCatalogo | undefined;
  prioridadPorCodigo: (codigo: string) => PrioridadCatalogo | undefined;
  nombrePrioridad: (codigo: string) => string;
  ordenPrioridad: (codigo: string) => number;
  colorPrioridad: (codigo: string) => string;
  prioridadOrdenMap: Record<string, number>;
};

const CatalogosContext = createContext<CatalogosContexto | null>(null);

function ordenarPorOrden<T extends { orden: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orden - b.orden);
}

async function cargarCatalogos(): Promise<{
  tipos: TipoSolicitudCatalogo[];
  prioridades: PrioridadCatalogo[];
}> {
  const [tipos, prioridades] = await Promise.all([
    fetchTiposSolicitud(),
    fetchPrioridades(),
  ]);
  return { tipos, prioridades };
}

export default function CatalogosProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tiposSolicitud, setTiposSolicitud] =
    useState<TipoSolicitudCatalogo[]>(TIPOS_FALLBACK);
  const [prioridades, setPrioridades] =
    useState<PrioridadCatalogo[]>(PRIORIDADES_FALLBACK);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    cargarCatalogos()
      .then(({ tipos, prioridades: prioridadesData }) => {
        if (cancelado) return;
        if (tipos.length > 0) {
          setTiposSolicitud(ordenarPorOrden(tipos));
        }
        if (prioridadesData.length > 0) {
          setPrioridades(ordenarPorOrden(prioridadesData));
        }
      })
      .catch(() => {
        // Se mantienen los catálogos de respaldo.
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const { tipos, prioridades: prioridadesData } = await cargarCatalogos();
      if (tipos.length > 0) {
        setTiposSolicitud(ordenarPorOrden(tipos));
      }
      if (prioridadesData.length > 0) {
        setPrioridades(ordenarPorOrden(prioridadesData));
      }
    } catch {
      // Se mantienen los catálogos de respaldo.
    } finally {
      setCargando(false);
    }
  }, []);

  const tiposPorCodigo = useMemo(() => {
    const mapa = new Map<string, TipoSolicitudCatalogo>();
    for (const tipo of tiposSolicitud) mapa.set(tipo.codigo, tipo);
    return mapa;
  }, [tiposSolicitud]);

  const prioridadesPorCodigo = useMemo(() => {
    const mapa = new Map<string, PrioridadCatalogo>();
    for (const prioridad of prioridades) mapa.set(prioridad.codigo, prioridad);
    return mapa;
  }, [prioridades]);

  const prioridadOrdenMap = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const prioridad of prioridades) {
      mapa[prioridad.codigo] = prioridad.orden;
    }
    return mapa;
  }, [prioridades]);

  const valor = useMemo<CatalogosContexto>(() => {
    const prioridadPorCodigo = (codigo: string) =>
      prioridadesPorCodigo.get(String(codigo).toUpperCase());

    return {
      tiposSolicitud,
      prioridades,
      cargando,
      recargar,
      tipoSolicitudPorCodigo: (codigo: string) =>
        tiposPorCodigo.get(String(codigo).toUpperCase()),
      prioridadPorCodigo,
      nombrePrioridad: (codigo: string) => {
        const prioridad = prioridadPorCodigo(codigo);
        return prioridad?.nombre ?? String(codigo ?? "");
      },
      ordenPrioridad: (codigo: string) =>
        prioridadPorCodigo(codigo)?.orden ?? 0,
      colorPrioridad: (codigo: string) =>
        prioridadPorCodigo(codigo)?.color ?? "",
      prioridadOrdenMap,
    };
  }, [
    tiposSolicitud,
    prioridades,
    cargando,
    recargar,
    tiposPorCodigo,
    prioridadesPorCodigo,
    prioridadOrdenMap,
  ]);

  return (
    <CatalogosContext.Provider value={valor}>
      {children}
    </CatalogosContext.Provider>
  );
}

export function useCatalogos(): CatalogosContexto {
  const ctx = useContext(CatalogosContext);
  if (!ctx) {
    throw new Error("useCatalogos debe usarse dentro de CatalogosProvider");
  }
  return ctx;
}
