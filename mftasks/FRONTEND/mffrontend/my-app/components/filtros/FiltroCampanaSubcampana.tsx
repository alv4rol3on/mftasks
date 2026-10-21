"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CampanaInfo, SubCampanaInfo } from "@/lib/types";

interface Props {
  campanaId: number | "";
  subcampanaId: number | "";
  entidadId?: number | "";
  onEntidadChange?: (entidadId: number | "") => void;
  onChange: (next: { campanaId: number | ""; subcampanaId: number | "" }) => void;
  selectStyle?: React.CSSProperties;
  selectClassName?: string;
  campanaAriaLabel?: string;
  subcampanaAriaLabel?: string;
}

/**
 * Filtro controlado de campaña/subcampaña. Carga las campañas visibles para el
 * usuario y las subcampañas de la campaña elegida.
 */
export default function FiltroCampanaSubcampana({
  campanaId,
  subcampanaId,
  entidadId,
  onEntidadChange,
  onChange,
  selectStyle,
  selectClassName,
  campanaAriaLabel = "Filtrar por campaña",
  subcampanaAriaLabel = "Filtrar por subcampaña",
}: Props) {
  const [campanas, setCampanas] = useState<CampanaInfo[]>([]);
  const [subcampanas, setSubcampanas] = useState<SubCampanaInfo[]>([]);

  const entidades = useMemo(() => {
    const map = new Map<number, string>();
    for (const campana of campanas) {
      if (typeof campana.entidad === "number") {
        map.set(campana.entidad, campana.entidad_nombre ?? `Entidad ${campana.entidad}`);
      }
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [campanas]);

  const campanasVisibles = useMemo(
    () =>
      entidadId === undefined || entidadId === ""
        ? campanas
        : campanas.filter((campana) => campana.entidad === entidadId),
    [campanas, entidadId]
  );

  useEffect(() => {
    let cancel = false;
    apiFetch<CampanaInfo[] | { results: CampanaInfo[] }>("/api/campanas/campanas/")
      .then((data) => {
        if (cancel) return;
        const arr = Array.isArray(data) ? data : (data as { results: CampanaInfo[] }).results ?? [];
        setCampanas(arr.filter((c) => c.activo));
      })
      .catch(() => {
        if (!cancel) setCampanas([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!campanaId) return;
    let cancel = false;
    apiFetch<SubCampanaInfo[] | { results: SubCampanaInfo[] }>(
      `/api/campanas/subcampanas/?campana_id=${campanaId}`
    )
      .then((data) => {
        if (cancel) return;
        const arr = Array.isArray(data) ? data : (data as { results: SubCampanaInfo[] }).results ?? [];
        setSubcampanas(arr.filter((s) => s.activo));
      })
      .catch(() => {
        if (!cancel) setSubcampanas([]);
      });
    return () => {
      cancel = true;
    };
  }, [campanaId]);

  const base: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    background: "white",
    minWidth: 170,
    ...selectStyle,
  };

  return (
    <>
      {onEntidadChange && (
        <select
          value={entidadId ?? ""}
          onChange={(e) => {
            onEntidadChange(e.target.value ? Number(e.target.value) : "");
            onChange({ campanaId: "", subcampanaId: "" });
          }}
          style={base}
          className={selectClassName}
          title="Filtrar por entidad"
          aria-label="Filtrar por entidad"
        >
          <option value="">Todas las entidades</option>
          {entidades.map((entidad) => (
            <option key={entidad.id} value={entidad.id}>{entidad.nombre}</option>
          ))}
        </select>
      )}

      <select
        value={campanaId}
        onChange={(e) =>
          onChange({
            campanaId: e.target.value ? Number(e.target.value) : "",
            subcampanaId: "",
          })
        }
        style={base}
        className={selectClassName}
        title="Filtrar por campaña"
        aria-label={campanaAriaLabel}
      >
        <option value="">Todas las campañas</option>
        {campanasVisibles.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      <select
        value={subcampanaId}
        onChange={(e) =>
          onChange({
            campanaId,
            subcampanaId: e.target.value ? Number(e.target.value) : "",
          })
        }
        style={base}
        className={selectClassName}
        disabled={!campanaId}
        title="Filtrar por subcampaña"
        aria-label={subcampanaAriaLabel}
      >
        <option value="">{campanaId ? "Todas las subcampañas" : "Elige campaña"}</option>
        {subcampanas.map((s) => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
    </>
  );
}
