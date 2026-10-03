"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CampanaInfo, SubCampanaInfo } from "@/lib/types";

interface Props {
  campanaId: number | "";
  subcampanaId: number | "";
  onChange: (next: { campanaId: number | ""; subcampanaId: number | "" }) => void;
  selectStyle?: React.CSSProperties;
}

/**
 * Filtro controlado de campaña/subcampaña. Carga las campañas visibles para el
 * usuario y las subcampañas de la campaña elegida.
 */
export default function FiltroCampanaSubcampana({
  campanaId,
  subcampanaId,
  onChange,
  selectStyle,
}: Props) {
  const [campanas, setCampanas] = useState<CampanaInfo[]>([]);
  const [subcampanas, setSubcampanas] = useState<SubCampanaInfo[]>([]);

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
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    background: "white",
    minWidth: 170,
    ...selectStyle,
  };

  return (
    <>
      <select
        value={campanaId}
        onChange={(e) =>
          onChange({
            campanaId: e.target.value ? Number(e.target.value) : "",
            subcampanaId: "",
          })
        }
        style={base}
        title="Filtrar por campaña"
      >
        <option value="">Todas las campañas</option>
        {campanas.map((c) => (
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
        disabled={!campanaId}
        title="Filtrar por subcampaña"
      >
        <option value="">{campanaId ? "Todas las subcampañas" : "Elige campaña"}</option>
        {subcampanas.map((s) => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
    </>
  );
}
