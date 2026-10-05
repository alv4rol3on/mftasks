"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import Switch from "@/components/ui/Switch";
import Pagination from "@/components/ui/Pagination";

import styles from "./AdminSections.module.css";
import CampanaModal from "./CampanaModal";

type Subcampana = {
  id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
  campana: number;
};

type CampanaPerm = {
  id: number;
  nombre: string;
  codigo: string;
  subcampanas: Subcampana[];
  activo: boolean;
};

type Props = {
  setMsg: (msg: string | null) => void;
};

const PAGE_SIZE_CAMPANAS = 6;

export default function CampanasSection({ setMsg }: Props) {
  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [filtroCampana, setFiltroCampana] = useState("");

  const [filtroActivoCampana, setFiltroActivoCampana] = useState<
    "activos" | "inactivos" | "todos"
  >("activos");

  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());

  const [pageCampanas, setPageCampanas] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);

  // --------------------------------------------------
  // CARGAR CAMPAÑAS
  // --------------------------------------------------

  const cargarCampanas = async () => {
    try {
      const data = await apiFetch<
        CampanaPerm[] | { results: CampanaPerm[] }
      >("/api/campanas/campanas/");

      const arr = Array.isArray(data) ? data : data.results ?? [];

      setCampanas(arr);
    } catch {
      setCampanas([]);
    }
  };

  useEffect(() => {
    cargarCampanas();
  }, []);

  // --------------------------------------------------
  // ACORDEÓN
  // --------------------------------------------------

  const toggleCampana = (id: number) => {
    setExpandidas(prev => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const expandirTodas = () => {
    setExpandidas(new Set(campanasPaginadas.map(campana => campana.id)));
  };

  const colapsarTodas = () => {
    setExpandidas(new Set());
  };

  // --------------------------------------------------
  // FILTROS
  // --------------------------------------------------

  const campanasFiltradas = campanas.filter(campana => {
    if (filtroActivoCampana === "activos" && !campana.activo) {
      return false;
    }

    if (filtroActivoCampana === "inactivos" && campana.activo) {
      return false;
    }

    if (!filtroCampana) {
      return true;
    }

    const q = filtroCampana.toLowerCase();

    return (
      campana.nombre.toLowerCase().includes(q) ||
      campana.codigo.toLowerCase().includes(q) ||
      campana.subcampanas.some(
        sub =>
          sub.nombre.toLowerCase().includes(q) ||
          sub.codigo.toLowerCase().includes(q)
      )
    );
  });

  // --------------------------------------------------
  // PAGINACIÓN
  // --------------------------------------------------

  const totalPagesCampanas = Math.max(
    1,
    Math.ceil(campanasFiltradas.length / PAGE_SIZE_CAMPANAS)
  );

  const campanasPaginadas = campanasFiltradas.slice(
    (pageCampanas - 1) * PAGE_SIZE_CAMPANAS,
    pageCampanas * PAGE_SIZE_CAMPANAS
  );

  useEffect(() => {
    setPageCampanas(1);
  }, [filtroCampana, filtroActivoCampana]);

  useEffect(() => {
    if (pageCampanas > totalPagesCampanas) {
      setPageCampanas(1);
    }
  }, [totalPagesCampanas, pageCampanas]);

  // --------------------------------------------------
  // AUTO-EXPANDIR AL BUSCAR
  // --------------------------------------------------

  useEffect(() => {
    if (filtroCampana.trim()) {
      setExpandidas(
        new Set(
          campanasFiltradas
            .slice(0, PAGE_SIZE_CAMPANAS)
            .map(campana => campana.id)
        )
      );
    }
  }, [filtroCampana]);

  useEffect(() => {
    setExpandidas(new Set());
  }, [filtroActivoCampana]);

  // --------------------------------------------------
  // ACTIVAR / DESACTIVAR CAMPAÑA
  // --------------------------------------------------

  const toggleActivoCampana = async (campana: CampanaPerm) => {
    if (
      !confirm(
        `${
          campana.activo ? "Inhabilitar" : "Habilitar"
        } campaña ${campana.nombre} (${campana.codigo})?${
          campana.activo
            ? " Ningún usuario podrá crear tareas con sus subcampañas."
            : ""
        }`
      )
    ) {
      return;
    }

    setTogglingId(campana.id);

    try {
      await apiFetch(`/api/campanas/campanas/${campana.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !campana.activo }),
      });

      setMsg(
        `Campaña ${campana.codigo} ${
          !campana.activo ? "habilitada" : "inhabilitada"
        }`
      );

      await cargarCampanas();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setTogglingId(null);
    }
  };

  // --------------------------------------------------
  // ACTIVAR / DESACTIVAR SUBCAMPAÑA
  // --------------------------------------------------

  const toggleActivoSubcampana = async (
    sub: Subcampana,
    campActiva: boolean
  ) => {
    if (!campActiva && !sub.activo) {
      setMsg("Error: la campaña está inhabilitada; habilítala primero");
      return;
    }

    if (
      !confirm(
        `${
          sub.activo ? "Inhabilitar" : "Habilitar"
        } subcampaña ${sub.nombre} (${sub.codigo})?${
          sub.activo ? " Ningún usuario podrá crear tareas con ella." : ""
        }`
      )
    ) {
      return;
    }

    setTogglingId(sub.id);

    try {
      await apiFetch(`/api/campanas/subcampanas/${sub.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !sub.activo }),
      });

      setMsg(
        `Subcampaña ${sub.codigo} ${
          !sub.activo ? "habilitada" : "inhabilitada"
        }`
      );

      await cargarCampanas();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setTogglingId(null);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.container}>
      {/* ESTADOS DE CAMPAÑAS */}

      <div className={styles.card}>
        <div className={styles.usersHeader}>
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>
            Estados de Campañas / Subcampañas
          </h3>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setModalOpen(true)}
          >
            + Nueva
          </button>
        </div>

        <div className={styles.permisosHeader}>
          <div className={styles.permisosField} style={{ maxWidth: 400 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Buscar campaña/subcampaña
            </label>

            <input
              placeholder="Filtrar por campaña o subcampaña"
              value={filtroCampana}
              onChange={e => setFiltroCampana(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.permisosField} style={{ maxWidth: 220 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Estado</label>

            <select
              value={filtroActivoCampana}
              onChange={e =>
                setFiltroActivoCampana(
                  e.target.value as "activos" | "inactivos" | "todos"
                )
              }
              className={styles.select}
            >
              <option value="activos">Activas</option>
              <option value="inactivos">Inactivas</option>
              <option value="todos">Todas</option>
            </select>
          </div>
        </div>

        {campanasFiltradas.length > PAGE_SIZE_CAMPANAS && (
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginBottom: 6,
            }}
          >
            {campanasFiltradas.length} campaña(s){" · "}
            Página {pageCampanas} de {totalPagesCampanas}
          </div>
        )}

        {campanasFiltradas.length > 1 && (
          <div className={styles.accordionActions}>
            <button
              type="button"
              onClick={expandirTodas}
              className={styles.linkBtn}
            >
              Expandir todo
            </button>

            <button
              type="button"
              onClick={colapsarTodas}
              className={styles.linkBtn}
            >
              Colapsar todo
            </button>
          </div>
        )}

        <div className={styles.campanasList}>
          {campanasFiltradas.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {filtroActivoCampana === "activos"
                ? "No hay campañas activas."
                : filtroActivoCampana === "inactivos"
                  ? "No hay campañas inactivas."
                  : "No hay campañas que coincidan."}
            </div>
          ) : (
            campanasPaginadas.map(camp => {
              const abierta = expandidas.has(camp.id);

              return (
                <div key={camp.id} className={styles.campanaCard}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={styles.campanaHead}
                    onClick={() => toggleCampana(camp.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleCampana(camp.id);
                      }
                    }}
                    aria-expanded={abierta}
                    style={{ cursor: "pointer" }}
                  >
                    <div>
                      <span className={styles.campanaTitle}>
                        {camp.nombre}
                      </span>{" "}
                      <span className={styles.campanaCode}>
                        ({camp.codigo})
                      </span>

                      <span
                        className={`${styles.badgeActive} ${
                          camp.activo
                            ? styles.badgeActiveOn
                            : styles.badgeActiveOff
                        }`}
                      >
                        {camp.activo ? "activa" : "inactiva"}
                      </span>
                    </div>

                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Switch
                        checked={camp.activo}
                        loading={togglingId === camp.id}
                        onChange={() => toggleActivoCampana(camp)}
                        label={
                          camp.activo
                            ? "Inhabilitar campaña"
                            : "Habilitar campaña"
                        }
                        title={
                          camp.activo
                            ? "Inhabilitar campaña"
                            : "Habilitar campaña"
                        }
                      />

                      <span className={styles.campanaCount}>
                        {camp.subcampanas.length} sub
                      </span>

                      <span
                        className={`${styles.chevron} ${
                          abierta ? styles.chevronOpen : ""
                        }`}
                      >
                        ▸
                      </span>
                    </span>
                  </div>

                  <div
                    className={`${styles.campanaBody} ${
                      abierta ? styles.campanaBodyOpen : ""
                    }`}
                  >
                    <div className={styles.campanaBodyInner}>
                      <div className={styles.subcampanasGrid}>
                        {camp.subcampanas.length === 0 ? (
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>
                            Sin subcampañas
                          </span>
                        ) : (
                          camp.subcampanas.map(sub => (
                            <div
                              key={sub.id}
                              className={styles.subLabel}
                              style={{
                                opacity:
                                  !camp.activo || !sub.activo ? 0.6 : 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                justifyContent: "space-between",
                              }}
                            >
                              <div className={styles.subInfo}>
                                <div className={styles.subName}>
                                  {sub.nombre}
                                </div>

                                <div className={styles.subCode}>
                                  {sub.codigo}{" "}
                                  {!sub.activo && "(inactiva)"}{" "}
                                  {!camp.activo && "(campaña inactiva)"}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span
                                  className={`${styles.badgeActive} ${
                                    sub.activo && camp.activo
                                      ? styles.badgeActiveOn
                                      : styles.badgeActiveOff
                                  }`}
                                  style={{ fontSize: 10 }}
                                >
                                  {sub.activo && camp.activo
                                    ? "habilitada"
                                    : "inhabilitada"}
                                </span>

                                <Switch
                                  checked={sub.activo}
                                  loading={togglingId === sub.id}
                                  disabled={!camp.activo && !sub.activo}
                                  onChange={() =>
                                    toggleActivoSubcampana(sub, camp.activo)
                                  }
                                  label={
                                    sub.activo
                                      ? "Inhabilitar subcampaña"
                                      : "Habilitar subcampaña"
                                  }
                                  title={
                                    !camp.activo && !sub.activo
                                      ? "La campaña está inhabilitada; habilítala primero"
                                      : sub.activo
                                        ? "Inhabilitar subcampaña"
                                        : "Habilitar subcampaña"
                                  }
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination
          page={pageCampanas}
          totalPages={totalPagesCampanas}
          totalItems={campanasFiltradas.length}
          pageSize={PAGE_SIZE_CAMPANAS}
          onPageChange={setPageCampanas}
        />
      </div>

      {modalOpen && (
        <CampanaModal
          campanas={campanas}
          onClose={() => setModalOpen(false)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarCampanas();
          }}
        />
      )}
    </div>
  );
}
