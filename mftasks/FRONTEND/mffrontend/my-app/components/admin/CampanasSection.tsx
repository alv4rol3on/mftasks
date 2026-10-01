"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import SearchableSelect, {
  SearchableOption,
} from "@/components/ui/SearchableSelect";
import Switch from "@/components/ui/Switch";
import Pagination from "@/components/ui/Pagination";

import {
  existeNombreNormalizado,
  nombresSimilares,
} from "@/lib/similitud";

import styles from "./AdminSections.module.css";

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

export default function CampanasSection({
  setMsg,
}: Props) {
  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [togglingId, setTogglingId] =
    useState<number | null>(null);

  const [filtroCampana, setFiltroCampana] =
    useState("");

  const [filtroActivoCampana, setFiltroActivoCampana] =
    useState<
      "activos" | "inactivos" | "todos"
    >("activos");

  const [expandidas, setExpandidas] =
    useState<Set<number>>(new Set());

  const [pageCampanas, setPageCampanas] =
    useState(1);

  const [tipoCreacion, setTipoCreacion] =
    useState<"campana" | "subcampana">(
      "campana"
    );

  const [nuevaCampanaNombre, setNuevaCampanaNombre] =
    useState("");

  const [nuevaSubcampana, setNuevaSubcampana] =
    useState({
      campanaId: "",
      nombre: "",
    });

  const [creandoCampana, setCreandoCampana] =
    useState(false);

  // --------------------------------------------------
  // CARGAR CAMPAÑAS
  // --------------------------------------------------

  const cargarCampanas = async () => {
    try {
      const data = await apiFetch<
        CampanaPerm[] | { results: CampanaPerm[] }
      >("/api/campanas/campanas/");

      const arr = Array.isArray(data)
        ? data
        : data.results ?? [];

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
    setExpandidas(
      new Set(
        campanasPaginadas.map(
          campana => campana.id
        )
      )
    );
  };

  const colapsarTodas = () => {
    setExpandidas(new Set());
  };

  // --------------------------------------------------
  // FILTROS
  // --------------------------------------------------

  const campanasFiltradas = campanas.filter(
    campana => {
      if (
        filtroActivoCampana === "activos" &&
        !campana.activo
      ) {
        return false;
      }

      if (
        filtroActivoCampana === "inactivos" &&
        campana.activo
      ) {
        return false;
      }

      if (!filtroCampana) {
        return true;
      }

      const q =
        filtroCampana.toLowerCase();

      return (
        campana.nombre
          .toLowerCase()
          .includes(q) ||
        campana.codigo
          .toLowerCase()
          .includes(q) ||
        campana.subcampanas.some(
          sub =>
            sub.nombre
              .toLowerCase()
              .includes(q) ||
            sub.codigo
              .toLowerCase()
              .includes(q)
        )
      );
    }
  );

  // --------------------------------------------------
  // PAGINACIÓN
  // --------------------------------------------------

  const totalPagesCampanas =
    Math.max(
      1,
      Math.ceil(
        campanasFiltradas.length /
          PAGE_SIZE_CAMPANAS
      )
    );

  const campanasPaginadas =
    campanasFiltradas.slice(
      (pageCampanas - 1) *
        PAGE_SIZE_CAMPANAS,
      pageCampanas *
        PAGE_SIZE_CAMPANAS
    );

  useEffect(() => {
    setPageCampanas(1);
  }, [
    filtroCampana,
    filtroActivoCampana,
  ]);

  useEffect(() => {
    if (
      pageCampanas >
      totalPagesCampanas
    ) {
      setPageCampanas(1);
    }
  }, [
    totalPagesCampanas,
    pageCampanas,
  ]);

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

  const toggleActivoCampana = async (
    campana: CampanaPerm
  ) => {
    if (
      !confirm(
        `${
          campana.activo
            ? "Inhabilitar"
            : "Habilitar"
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
      await apiFetch(
        `/api/campanas/campanas/${campana.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            activo: !campana.activo,
          }),
        }
      );

      setMsg(
        `Campaña ${campana.codigo} ${
          !campana.activo
            ? "habilitada"
            : "inhabilitada"
        }`
      );

      await cargarCampanas();
    } catch (e) {
      setMsg(
        `Error: ${(e as Error).message}`
      );
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
      setMsg(
        "Error: la campaña está inhabilitada; habilítala primero"
      );
      return;
    }

    if (
      !confirm(
        `${
          sub.activo
            ? "Inhabilitar"
            : "Habilitar"
        } subcampaña ${sub.nombre} (${sub.codigo})?${
          sub.activo
            ? " Ningún usuario podrá crear tareas con ella."
            : ""
        }`
      )
    ) {
      return;
    }

    setTogglingId(sub.id);

    try {
      await apiFetch(
        `/api/campanas/subcampanas/${sub.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            activo: !sub.activo,
          }),
        }
      );

      setMsg(
        `Subcampaña ${sub.codigo} ${
          !sub.activo
            ? "habilitada"
            : "inhabilitada"
        }`
      );

      await cargarCampanas();
    } catch (e) {
      setMsg(
        `Error: ${(e as Error).message}`
      );
    } finally {
      setTogglingId(null);
    }
  };

  // --------------------------------------------------
  // FORMULARIO
  // --------------------------------------------------

  const subcampanasPadre = useMemo(() => {
    if (!nuevaSubcampana.campanaId) {
      return [];
    }

    const padre = campanas.find(
      c =>
        String(c.id) ===
        nuevaSubcampana.campanaId
    );

    return padre?.subcampanas ?? [];
  }, [
    campanas,
    nuevaSubcampana.campanaId,
  ]);

  const sugerenciasCampana = useMemo(
    () =>
      nombresSimilares(
        nuevaCampanaNombre,
        campanas
      ),
    [nuevaCampanaNombre, campanas]
  );

  const campanaDuplicada = useMemo(
    () =>
      Boolean(
        existeNombreNormalizado(
          nuevaCampanaNombre,
          campanas
        )
      ),
    [nuevaCampanaNombre, campanas]
  );

  const sugerenciasSubcampana = useMemo(
    () =>
      nombresSimilares(
        nuevaSubcampana.nombre,
        subcampanasPadre
      ),
    [
      nuevaSubcampana.nombre,
      subcampanasPadre,
    ]
  );

  const subcampanaDuplicada = useMemo(
    () =>
      Boolean(
        existeNombreNormalizado(
          nuevaSubcampana.nombre,
          subcampanasPadre
        )
      ),
    [
      nuevaSubcampana.nombre,
      subcampanasPadre,
    ]
  );

  const opcionesCampana: SearchableOption[] =
    useMemo(
      () =>
        campanas.map(campana => ({
          value: String(campana.id),
          label: `${campana.nombre} (${campana.codigo})`,
          sublabel: campana.activo
            ? undefined
            : "inactiva",
        })),
      [campanas]
    );

  // --------------------------------------------------
  // CREAR CAMPAÑA
  // --------------------------------------------------

  const crearCampana = async () => {
    if (!nuevaCampanaNombre.trim()) {
      setMsg(
        "Error: el nombre de la campaña es obligatorio"
      );
      return;
    }

    if (campanaDuplicada) {
      setMsg(
        "Error: ya existe una campaña con un nombre igual o similar"
      );
      return;
    }

    setCreandoCampana(true);

    try {
      await apiFetch(
        "/api/campanas/campanas/",
        {
          method: "POST",
          body: JSON.stringify({
            nombre:
              nuevaCampanaNombre.trim(),
          }),
        }
      );

      setMsg(
        `Campaña "${nuevaCampanaNombre.trim()}" creada`
      );

      setNuevaCampanaNombre("");

      await cargarCampanas();
    } catch (e) {
      setMsg(
        `Error: ${(e as Error).message}`
      );
    } finally {
      setCreandoCampana(false);
    }
  };

  // --------------------------------------------------
  // CREAR SUBCAMPAÑA
  // --------------------------------------------------

  const crearSubcampana = async () => {
    if (!nuevaSubcampana.campanaId) {
      setMsg(
        "Error: selecciona una campaña padre"
      );
      return;
    }

    if (!nuevaSubcampana.nombre.trim()) {
      setMsg(
        "Error: el nombre de la subcampaña es obligatorio"
      );
      return;
    }

    if (subcampanaDuplicada) {
      setMsg(
        "Error: ya existe una subcampaña con ese nombre en la campaña seleccionada"
      );
      return;
    }

    setCreandoCampana(true);

    try {
      await apiFetch(
        "/api/campanas/subcampanas/",
        {
          method: "POST",
          body: JSON.stringify({
            campana: Number(
              nuevaSubcampana.campanaId
            ),
            nombre:
              nuevaSubcampana.nombre.trim(),
          }),
        }
      );

      setMsg(
        `Subcampaña "${nuevaSubcampana.nombre.trim()}" creada`
      );

      setNuevaSubcampana({
        campanaId: "",
        nombre: "",
      });

      await cargarCampanas();
    } catch (e) {
      setMsg(
        `Error: ${(e as Error).message}`
      );
    } finally {
      setCreandoCampana(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.container}>

      {/* CREAR CAMPAÑA / SUBCAMPAÑA */}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          Registrar campaña / subcampaña
        </h3>

        <div className={styles.createToggle}>
          <button
            type="button"
            onClick={() =>
              setTipoCreacion("campana")
            }
            className={
              tipoCreacion === "campana"
                ? styles.createToggleActive
                : styles.createToggleBtn
            }
          >
            Nueva campaña
          </button>

          <button
            type="button"
            onClick={() =>
              setTipoCreacion("subcampana")
            }
            className={
              tipoCreacion === "subcampana"
                ? styles.createToggleActive
                : styles.createToggleBtn
            }
          >
            Nueva subcampaña
          </button>
        </div>

        {tipoCreacion === "campana" ? (
          <div className={styles.createForm}>

            <div
              className={styles.createField}
              style={{
                position: "relative",
              }}
            >
              <label
                style={{ color: "black" }}
              >
                Nombre campaña *
              </label>

              <input
                placeholder="Ej: BBVA, CSC, BCP..."
                value={nuevaCampanaNombre}
                onChange={e =>
                  setNuevaCampanaNombre(
                    e.target.value
                  )
                }
                className={styles.input}
              />

              {campanaDuplicada && (
                <div
                  className={
                    styles.dupWarning
                  }
                >
                  Ya existe una campaña con
                  ese nombre.
                </div>
              )}

              {!campanaDuplicada &&
                sugerenciasCampana.length >
                  0 && (
                  <div
                    className={
                      styles.sugerencias
                    }
                  >
                    <div
                      className={
                        styles.sugerenciasTitle
                      }
                    >
                      Campañas existentes
                      similares:
                    </div>

                    {sugerenciasCampana.map(
                      c => (
                        <div
                          key={c.id}
                          className={
                            styles.sugerenciaItem
                          }
                        >
                          {c.nombre}{" "}
                          <span
                            className={
                              styles.sugerenciaCode
                            }
                          >
                            ({c.codigo})
                          </span>{" "}
                          {!c.activo &&
                            "— inactiva"}
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>

            <button
              onClick={crearCampana}
              disabled={
                creandoCampana ||
                !nuevaCampanaNombre.trim() ||
                campanaDuplicada
              }
              className={styles.btnPrimary}
              style={{
                opacity:
                  creandoCampana ||
                  !nuevaCampanaNombre.trim() ||
                  campanaDuplicada
                    ? 0.6
                    : 1,
              }}
            >
              {creandoCampana
                ? "Creando..."
                : "Crear campaña"}
            </button>
          </div>
        ) : (
          <div className={styles.createForm}>

            <div
              className={styles.createField}
            >
              <label
                style={{ color: "black" }}
              >
                Campaña padre *
              </label>

              <SearchableSelect
                value={
                  nuevaSubcampana.campanaId
                }
                onChange={v =>
                  setNuevaSubcampana({
                    ...nuevaSubcampana,
                    campanaId: v,
                  })
                }
                options={opcionesCampana}
                placeholder="Buscar campaña por nombre o código..."
              />
            </div>

            <div
              className={styles.createField}
              style={{
                position: "relative",
              }}
            >
              <label
                style={{ color: "black" }}
              >
                Nombre subcampaña *
              </label>

              <input
                placeholder="Ej: Tarjetas Out, Digital..."
                value={
                  nuevaSubcampana.nombre
                }
                onChange={e =>
                  setNuevaSubcampana({
                    ...nuevaSubcampana,
                    nombre: e.target.value,
                  })
                }
                className={styles.input}
              />

              <span
                className={styles.createHint}
              >
                El código se genera como
                CODIGO_CAMPANA_NOMBRE.
              </span>

              {subcampanaDuplicada && (
                <div
                  className={
                    styles.dupWarning
                  }
                >
                  Ya existe una subcampaña
                  con ese nombre en la campaña
                  seleccionada.
                </div>
              )}

              {!subcampanaDuplicada &&
                sugerenciasSubcampana.length >
                  0 && (
                  <div
                    className={
                      styles.sugerencias
                    }
                  >
                    <div
                      className={
                        styles.sugerenciasTitle
                      }
                    >
                      Subcampañas existentes
                      similares:
                    </div>

                    {sugerenciasSubcampana.map(
                      s => (
                        <div
                          key={s.id}
                          className={
                            styles.sugerenciaItem
                          }
                        >
                          {s.nombre}{" "}
                          <span
                            className={
                              styles.sugerenciaCode
                            }
                          >
                            ({s.codigo})
                          </span>{" "}
                          {!s.activo &&
                            "— inactiva"}
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>

            <button
              onClick={crearSubcampana}
              disabled={
                creandoCampana ||
                !nuevaSubcampana.campanaId ||
                !nuevaSubcampana.nombre.trim() ||
                subcampanaDuplicada
              }
              className={styles.btnPrimary}
              style={{
                opacity:
                  creandoCampana ||
                  !nuevaSubcampana.campanaId ||
                  !nuevaSubcampana.nombre.trim() ||
                  subcampanaDuplicada
                    ? 0.6
                    : 1,
              }}
            >
              {creandoCampana
                ? "Creando..."
                : "Crear subcampaña"}
            </button>

          </div>
        )}
      </div>

      {/* ESTADOS DE CAMPAÑAS */}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          Estados de Campañas / Subcampañas
        </h3>

        <div className={styles.permisosHeader}>

          <div
            className={styles.permisosField}
            style={{ maxWidth: 400 }}
          >
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Buscar campaña/subcampaña
            </label>

            <input
              placeholder="Filtrar por campaña o subcampaña"
              value={filtroCampana}
              onChange={e =>
                setFiltroCampana(
                  e.target.value
                )
              }
              className={styles.input}
            />
          </div>

          <div
            className={styles.permisosField}
            style={{ maxWidth: 220 }}
          >
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Estado
            </label>

            <select
              value={filtroActivoCampana}
              onChange={e =>
                setFiltroActivoCampana(
                  e.target.value as
                    | "activos"
                    | "inactivos"
                    | "todos"
                )
              }
              className={styles.select}
            >
              <option value="activos">
                Activas
              </option>

              <option value="inactivos">
                Inactivas
              </option>

              <option value="todos">
                Todas
              </option>
            </select>
          </div>

        </div>

        {campanasFiltradas.length >
          PAGE_SIZE_CAMPANAS && (
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginBottom: 6,
            }}
          >
            {campanasFiltradas.length} campaña(s)
            {" · "}
            Página {pageCampanas} de{" "}
            {totalPagesCampanas}
          </div>
        )}

        {campanasFiltradas.length > 1 && (
          <div
            className={
              styles.accordionActions
            }
          >
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
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              {filtroActivoCampana ===
              "activos"
                ? "No hay campañas activas."
                : filtroActivoCampana ===
                  "inactivos"
                ? "No hay campañas inactivas."
                : "No hay campañas que coincidan."}
            </div>
          ) : (
            campanasPaginadas.map(camp => {
              const abierta =
                expandidas.has(camp.id);

              return (
                <div
                  key={camp.id}
                  className={
                    styles.campanaCard
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className={
                      styles.campanaHead
                    }
                    onClick={() =>
                      toggleCampana(
                        camp.id
                      )
                    }
                    onKeyDown={e => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        toggleCampana(
                          camp.id
                        );
                      }
                    }}
                    aria-expanded={abierta}
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <span
                        className={
                          styles.campanaTitle
                        }
                      >
                        {camp.nombre}
                      </span>{" "}
                      <span
                        className={
                          styles.campanaCode
                        }
                      >
                        ({camp.codigo})
                      </span>

                      <span
                        className={`${styles.badgeActive} ${
                          camp.activo
                            ? styles.badgeActiveOn
                            : styles.badgeActiveOff
                        }`}
                      >
                        {camp.activo
                          ? "activa"
                          : "inactiva"}
                      </span>
                    </div>

                    <span
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 8,
                      }}
                    >
                      <Switch
                        checked={camp.activo}
                        loading={
                          togglingId ===
                          camp.id
                        }
                        onChange={() =>
                          toggleActivoCampana(
                            camp
                          )
                        }
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

                      <span
                        className={
                          styles.campanaCount
                        }
                      >
                        {camp.subcampanas.length}{" "}
                        sub
                      </span>

                      <span
                        className={`${styles.chevron} ${
                          abierta
                            ? styles.chevronOpen
                            : ""
                        }`}
                      >
                        ▸
                      </span>
                    </span>
                  </div>

                  <div
                    className={`${styles.campanaBody} ${
                      abierta
                        ? styles.campanaBodyOpen
                        : ""
                    }`}
                  >
                    <div
                      className={
                        styles.campanaBodyInner
                      }
                    >
                      <div
                        className={
                          styles.subcampanasGrid
                        }
                      >
                        {camp.subcampanas
                          .length === 0 ? (
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                "#9ca3af",
                            }}
                          >
                            Sin subcampañas
                          </span>
                        ) : (
                          camp.subcampanas.map(
                            sub => (
                              <div
                                key={sub.id}
                                className={
                                  styles.subLabel
                                }
                                style={{
                                  opacity:
                                    !camp.activo ||
                                    !sub.activo
                                      ? 0.6
                                      : 1,
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 8,
                                  justifyContent:
                                    "space-between",
                                }}
                              >
                                <div
                                  className={
                                    styles.subInfo
                                  }
                                >
                                  <div
                                    className={
                                      styles.subName
                                    }
                                  >
                                    {sub.nombre}
                                  </div>

                                  <div
                                    className={
                                      styles.subCode
                                    }
                                  >
                                    {sub.codigo}{" "}
                                    {!sub.activo &&
                                      "(inactiva)"}{" "}
                                    {!camp.activo &&
                                      "(campaña inactiva)"}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    gap: 6,
                                  }}
                                >
                                  <span
                                    className={`${styles.badgeActive} ${
                                      sub.activo &&
                                      camp.activo
                                        ? styles.badgeActiveOn
                                        : styles.badgeActiveOff
                                    }`}
                                    style={{
                                      fontSize: 10,
                                    }}
                                  >
                                    {sub.activo &&
                                    camp.activo
                                      ? "habilitada"
                                      : "inhabilitada"}
                                  </span>

                                  <Switch
                                    checked={
                                      sub.activo
                                    }
                                    loading={
                                      togglingId ===
                                      sub.id
                                    }
                                    disabled={
                                      !camp.activo &&
                                      !sub.activo
                                    }
                                    onChange={() =>
                                      toggleActivoSubcampana(
                                        sub,
                                        camp.activo
                                      )
                                    }
                                    label={
                                      sub.activo
                                        ? "Inhabilitar subcampaña"
                                        : "Habilitar subcampaña"
                                    }
                                    title={
                                      !camp.activo &&
                                      !sub.activo
                                        ? "La campaña está inhabilitada; habilítala primero"
                                        : sub.activo
                                        ? "Inhabilitar subcampaña"
                                        : "Habilitar subcampaña"
                                    }
                                  />
                                </div>
                              </div>
                            )
                          )
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
          totalItems={
            campanasFiltradas.length
          }
          pageSize={PAGE_SIZE_CAMPANAS}
          onPageChange={setPageCampanas}
        />
      </div>
    </div>
  );
}