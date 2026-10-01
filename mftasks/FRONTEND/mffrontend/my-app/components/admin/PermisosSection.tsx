
"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import Pagination from "@/components/ui/Pagination";

import CampanaAccordion from "./CampanaAccordion";

import styles from "./AdminSections.module.css";

type Usuario = {
  id: number;
  codigo?: string;
  email: string;
  nombres: string;
  apellidos: string;
  cargo?: string;
  is_active: boolean;
  roles?: string[];
};

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

type Permiso = {
  id: number;
  usuario: number;
  usuario_email: string;
  subcampana: number | null;
  subcampana_nombre: string | null;
  campana: number | null;
  campana_nombre: string | null;
};

type Props = {
  setMsg: (msg: string | null) => void;
};

const PAGE_SIZE_CAMPANAS = 6;

export default function PermisosSection({ setMsg }: Props) {
  // ---------------------------------------------------------
  // USUARIOS / CLIENTES
  // ---------------------------------------------------------

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  const [selectedClienteId, setSelectedClienteId] = useState<number | "">(
    ""
  );

  const [filtroClientePerm, setFiltroClientePerm] = useState("");

  // ---------------------------------------------------------
  // CAMPAÑAS
  // ---------------------------------------------------------

  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [cargandoCampanas, setCargandoCampanas] = useState(false);

  const [filtroCampana, setFiltroCampana] = useState("");

  const [filtroActivoCampana, setFiltroActivoCampana] = useState<
    "activos" | "inactivos" | "todos"
  >("activos");

  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());

  const [pagePermisosCampanas, setPagePermisosCampanas] = useState(1);

  // ---------------------------------------------------------
  // PERMISOS
  // ---------------------------------------------------------

  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [buscandoPermisos, setBuscandoPermisos] = useState(false);

  // ---------------------------------------------------------
  // CARGAR USUARIOS
  // ---------------------------------------------------------

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);

    try {
      const data = await apiFetch<
        Usuario[] | { results: Usuario[] }
      >("/api/usuarios/usuarios/");

      const arr = Array.isArray(data)
        ? data
        : (data as any).results ?? [];

      setUsuarios(arr);
    } catch (e) {
      console.error("Error cargando usuarios:", e);
      setUsuarios([]);
      setMsg(`Error cargando usuarios: ${(e as Error).message}`);
    } finally {
      setCargandoUsuarios(false);
    }
  };

  // ---------------------------------------------------------
  // CARGAR CAMPAÑAS
  // ---------------------------------------------------------

  const cargarCampanas = async () => {
    setCargandoCampanas(true);

    try {
      const data = await apiFetch<
        CampanaPerm[] | { results: CampanaPerm[] }
      >("/api/campanas/campanas/");

      const arr = Array.isArray(data)
        ? data
        : (data as any).results ?? [];

      setCampanas(arr);
    } catch (e) {
      console.error("Error cargando campañas:", e);
      setCampanas([]);
      setMsg(`Error cargando campañas: ${(e as Error).message}`);
    } finally {
      setCargandoCampanas(false);
    }
  };

  // ---------------------------------------------------------
  // CARGAR PERMISOS DEL CLIENTE
  // ---------------------------------------------------------

  const cargarPermisos = async (usuarioId: number) => {
    setBuscandoPermisos(true);

    try {
      const data = await apiFetch<
        Permiso[] | { results: Permiso[] }
      >(`/api/campanas/permisos/?usuario=${usuarioId}`);

      const arr = Array.isArray(data)
        ? data
        : (data as any).results ?? [];

      setPermisos(arr);
    } catch (e) {
      console.error("Error cargando permisos:", e);
      setMsg(`Error cargando permisos: ${(e as Error).message}`);
      setPermisos([]);
    } finally {
      setBuscandoPermisos(false);
    }
  };

  // ---------------------------------------------------------
  // CARGA INICIAL
  // ---------------------------------------------------------

  useEffect(() => {
    cargarUsuarios();
    cargarCampanas();
  }, []);

  // ---------------------------------------------------------
  // CAMBIO DE CLIENTE
  // ---------------------------------------------------------

  useEffect(() => {
    setExpandidas(new Set());
    setPagePermisosCampanas(1);

    if (selectedClienteId !== "") {
      cargarPermisos(Number(selectedClienteId));
    } else {
      setPermisos([]);
    }
  }, [selectedClienteId]);

  // ---------------------------------------------------------
  // CLIENTES
  // ---------------------------------------------------------

  const clientes = usuarios.filter((u) =>
    (u.roles ?? [])
      .map((r) => r.toLowerCase())
      .includes("cliente")
  );

  const clientesFiltrados = clientes.filter((u) => {
    if (!filtroClientePerm) return true;

    const q = filtroClientePerm.toLowerCase();

    return (
      u.email.toLowerCase().includes(q) ||
      `${u.nombres} ${u.apellidos}`
        .toLowerCase()
        .includes(q) ||
      (u.codigo ?? "").toLowerCase().includes(q)
    );
  });

  const clienteSeleccionado = usuarios.find(
    (u) => u.id === selectedClienteId
  );

  // ---------------------------------------------------------
  // PERMISOS → IDS DE SUBCAMPAÑAS
  // ---------------------------------------------------------

  const permisosSubcampanaIds = new Set(
    permisos
      .filter((p) => p.subcampana != null)
      .map((p) => p.subcampana as number)
  );

  // ---------------------------------------------------------
  // FILTRO DE CAMPAÑAS
  // ---------------------------------------------------------

  const campanasFiltradas = campanas.filter((camp) => {
    if (
      filtroActivoCampana === "activos" &&
      !camp.activo
    ) {
      return false;
    }

    if (
      filtroActivoCampana === "inactivos" &&
      camp.activo
    ) {
      return false;
    }

    if (!filtroCampana) {
      return true;
    }

    const q = filtroCampana.toLowerCase();

    return (
      camp.nombre.toLowerCase().includes(q) ||
      camp.codigo.toLowerCase().includes(q) ||
      camp.subcampanas.some(
        (sub) =>
          sub.nombre.toLowerCase().includes(q) ||
          sub.codigo.toLowerCase().includes(q)
      )
    );
  });

  // ---------------------------------------------------------
  // PAGINACIÓN
  // ---------------------------------------------------------

  const totalPagesPermisos = Math.max(
    1,
    Math.ceil(
      campanasFiltradas.length / PAGE_SIZE_CAMPANAS
    )
  );

  const campanasPaginadasPermisos =
    campanasFiltradas.slice(
      (pagePermisosCampanas - 1) *
        PAGE_SIZE_CAMPANAS,
      pagePermisosCampanas *
        PAGE_SIZE_CAMPANAS
    );

  useEffect(() => {
    setPagePermisosCampanas(1);
  }, [
    filtroCampana,
    filtroActivoCampana,
    selectedClienteId,
  ]);

  useEffect(() => {
    if (
      pagePermisosCampanas >
      totalPagesPermisos
    ) {
      setPagePermisosCampanas(1);
    }
  }, [
    totalPagesPermisos,
    pagePermisosCampanas,
  ]);

  // ---------------------------------------------------------
  // ACORDEÓN
  // ---------------------------------------------------------

  const toggleCampana = (id: number) => {
    setExpandidas((prev) => {
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
        campanasPaginadasPermisos.map(
          (c) => c.id
        )
      )
    );
  };

  const colapsarTodas = () => {
    setExpandidas(new Set());
  };

  // ---------------------------------------------------------
  // AUTO-EXPANDIR AL BUSCAR
  // ---------------------------------------------------------

  useEffect(() => {
    if (filtroCampana.trim()) {
      setExpandidas(
        new Set(
          campanasPaginadasPermisos.map(
            (c) => c.id
          )
        )
      );
    }
  }, [
    filtroCampana,
    pagePermisosCampanas,
  ]);

  // ---------------------------------------------------------
  // TOGGLE PERMISO
  // ---------------------------------------------------------

  const togglePermiso = async (
    subcampanaId: number,
    checked: boolean
  ) => {
    if (selectedClienteId === "") {
      setMsg(
        "Error: selecciona un cliente primero"
      );
      return;
    }

    const clienteId = Number(
      selectedClienteId
    );

    setCargandoPermisos(true);

    try {
      if (checked) {
        await apiFetch(
          "/api/campanas/permisos/",
          {
            method: "POST",
            body: JSON.stringify({
              usuario: clienteId,
              subcampana: subcampanaId,
            }),
          }
        );

        setMsg(
          `Permiso otorgado para subcampaña ${subcampanaId}`
        );
      } else {
        const perm = permisos.find(
          (p) =>
            p.subcampana === subcampanaId
        );

        if (!perm) {
          setMsg(
            "Error: permiso no encontrado"
          );
          return;
        }

        await apiFetch(
          `/api/campanas/permisos/${perm.id}/`,
          {
            method: "DELETE",
          }
        );

        setMsg(
          `Permiso revocado para subcampaña ${subcampanaId}`
        );
      }

      await cargarPermisos(clienteId);
    } catch (e) {
      setMsg(
        `Error: ${(e as Error).message}`
      );
    } finally {
      setCargandoPermisos(false);
    }
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          Permisos — Cliente → Subcampañas
        </h3>

        <p className={styles.permisosDesc}>
          Selecciona un usuario tipo{" "}
          <strong>cliente</strong> y marca las
          subcampañas a las que podrá solicitar
          tareas. El permiso es puntual por
          subcampaña (no hereda toda la campaña).
        </p>

        {/* ------------------------------------------------ */}
        {/* SELECCIÓN DE CLIENTE                            */}
        {/* ------------------------------------------------ */}

        <div className={styles.permisosHeader}>
          <label className={styles.permisosField}>
            Cliente ({clientes.length} totales)

            <div
              className={styles.permisosFieldSmall}
              style={{ position: "relative" }}
            >
              <input
                placeholder="Filtrar cliente por email/nombre/codigo"
                value={filtroClientePerm}
                onChange={(e) =>
                  setFiltroClientePerm(
                    e.target.value
                  )
                }
                className={styles.input}
                style={{ fontSize: 12 }}
              />

              {filtroClientePerm &&
                clientesFiltrados.length > 0 && (
                  <div
                    className={
                      styles.clienteDropdown
                    }
                  >
                    {clientesFiltrados
                      .slice(0, 8)
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedClienteId(
                              c.id
                            );
                            setFiltroClientePerm(
                              ""
                            );
                          }}
                          className={`${styles.clienteOption} ${
                            selectedClienteId ===
                            c.id
                              ? styles.clienteOptionActive
                              : ""
                          }`}
                        >
                          <span
                            style={{
                              fontFamily:
                                "monospace",
                              fontWeight: 700,
                            }}
                          >
                            {c.codigo ?? c.id}
                          </span>{" "}
                          — {c.email} (
                          {c.nombres}{" "}
                          {c.apellidos})
                        </div>
                      ))}
                  </div>
                )}
            </div>

            {selectedClienteId !== "" && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  fontSize: 12,
                  color: "#374151",
                }}
              >
                <span>
                  Seleccionado:{" "}
                  <strong
                    style={{
                      fontFamily: "monospace",
                    }}
                  >
                    {clienteSeleccionado?.codigo ??
                      selectedClienteId}
                  </strong>{" "}
                  — {clienteSeleccionado?.email}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedClienteId("");
                    setFiltroClientePerm("");
                  }}
                  title="Quitar selección"
                  style={{
                    border:
                      "1px solid #d1d5db",
                    background: "white",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                    color: "#b91c1c",
                  }}
                >
                  ✕ Quitar selección
                </button>
              </span>
            )}
          </label>

          {/* ------------------------------------------------ */}
          {/* FILTROS DE CAMPAÑAS                             */}
          {/* ------------------------------------------------ */}

          <div className={styles.permisosField}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Campañas
            </label>

            <input
              placeholder="Buscar campaña o subcampaña..."
              value={filtroCampana}
              onChange={(e) =>
                setFiltroCampana(
                  e.target.value
                )
              }
              className={styles.input}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 6,
              }}
            >
              <select
                value={filtroActivoCampana}
                onChange={(e) =>
                  setFiltroActivoCampana(
                    e.target.value as
                      | "activos"
                      | "inactivos"
                      | "todos"
                  )
                }
                className={styles.select}
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                }}
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

            {selectedClienteId !== "" && (
              <div
                className={`${styles.permisosStatus} ${
                  buscandoPermisos
                    ? styles.permisosStatusLoading
                    : styles.permisosStatusOk
                }`}
              >
                {buscandoPermisos
                  ? "Cargando permisos..."
                  : `${permisos.length} subcampaña(s) permitida(s) para este cliente`}

                {cargandoPermisos &&
                  " — actualizando..."}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------ */}
        {/* RESUMEN DE PERMISOS                             */}
        {/* ------------------------------------------------ */}

        {selectedClienteId !== "" &&
          permisos.length > 0 && (
            <div
              className={styles.resumenCard}
            >
              <h4
                className={styles.resumenTitle}
              >
                Resumen — subcampañas permitidas (
                {permisos.length})
              </h4>

              <div className={styles.chips}>
                {permisos.map((p) => (
                  <span
                    key={p.id}
                    className={styles.chip}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                      }}
                    >
                      {p.subcampana_nombre ??
                        p.subcampana}
                    </span>

                    <span
                      style={{
                        fontFamily: "monospace",
                        color: "#6b7280",
                      }}
                    >
                      ({p.subcampana})
                    </span>

                    <button
                      type="button"
                      onClick={async () => {
                        setCargandoPermisos(
                          true
                        );

                        try {
                          await apiFetch(
                            `/api/campanas/permisos/${p.id}/`,
                            {
                              method: "DELETE",
                            }
                          );

                          setMsg(
                            "Permiso revocado"
                          );

                          await cargarPermisos(
                            Number(
                              selectedClienteId
                            )
                          );
                        } catch (e) {
                          setMsg(
                            `Error: ${
                              (e as Error)
                                .message
                            }`
                          );
                        } finally {
                          setCargandoPermisos(
                            false
                          );
                        }
                      }}
                      className={
                        styles.chipRemove
                      }
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

        {/* ------------------------------------------------ */}
        {/* CAMPAÑAS                                        */}
        {/* ------------------------------------------------ */}

        {selectedClienteId === "" ? (
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              marginTop: 16,
            }}
          >
            Selecciona un cliente para gestionar
            sus permisos.
          </div>
        ) : (
          <>
            {cargandoUsuarios ||
            cargandoCampanas ? (
              <div
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  marginTop: 16,
                }}
              >
                Cargando información...
              </div>
            ) : (
              <>
                {campanasFiltradas.length >
                  PAGE_SIZE_CAMPANAS && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      marginBottom: 6,
                    }}
                  >
                    {campanasFiltradas.length}{" "}
                    campaña(s) · Página{" "}
                    {pagePermisosCampanas} de{" "}
                    {totalPagesPermisos}
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

                <div
                  className={
                    styles.campanasList
                  }
                >
                  {campanasFiltradas.length ===
                  0 ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                      }}
                    >
                      {filtroActivoCampana ===
                      "activos"
                        ? "No hay campañas activas que coincidan."
                        : filtroActivoCampana ===
                          "inactivos"
                        ? "No hay campañas inactivas que coincidan."
                        : "No hay campañas que coincidan."}
                    </div>
                  ) : (
                    campanasPaginadasPermisos.map(
                      (camp) => {
                        const abierta =
                          expandidas.has(
                            camp.id
                          );

                        const permitidas =
                          camp.subcampanas.filter(
                            (sub) =>
                              permisosSubcampanaIds.has(
                                sub.id
                              )
                          ).length;

                        return (
                          <CampanaAccordion
                            key={camp.id}
                            campana={camp}
                            abierta={abierta}
                            onToggle={() =>
                              toggleCampana(
                                camp.id
                              )
                            }
                            showSubCount={false}
                            headerRight={
                              <span
                                className={
                                  styles.campanaCount
                                }
                              >
                                {permitidas}/
                                {
                                  camp
                                    .subcampanas
                                    .length
                                }{" "}
                                permitidas
                              </span>
                            }
                          >
                            <div
                              className={
                                styles.subcampanasGrid
                              }
                            >
                              {camp
                                .subcampanas
                                .length === 0 ? (
                                <span
                                  style={{
                                    fontSize: 12,
                                    color:
                                      "#9ca3af",
                                  }}
                                >
                                  Sin
                                  subcampañas
                                </span>
                              ) : (
                                camp.subcampanas.map(
                                  (sub) => {
                                    const checked =
                                      permisosSubcampanaIds.has(
                                        sub.id
                                      );

                                    return (
                                      <label
                                        key={
                                          sub.id
                                        }
                                        className={`${
                                          styles.subLabel
                                        } ${
                                          checked
                                            ? styles.subLabelChecked
                                            : ""
                                        } ${
                                          cargandoPermisos
                                            ? styles.subLabelDisabled
                                            : ""
                                        }`}
                                        style={{
                                          opacity:
                                            sub.activo
                                              ? 1
                                              : 0.6,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={
                                            checked
                                          }
                                          disabled={
                                            cargandoPermisos ||
                                            !sub.activo
                                          }
                                          onChange={(
                                            e
                                          ) =>
                                            togglePermiso(
                                              sub.id,
                                              e.target
                                                .checked
                                            )
                                          }
                                          style={{
                                            width: 16,
                                            height: 16,
                                            accentColor:
                                              "#7c3aed",
                                          }}
                                        />

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
                                            {
                                              sub.nombre
                                            }
                                          </div>

                                          <div
                                            className={
                                              styles.subCode
                                            }
                                          >
                                            {
                                              sub.codigo
                                            }{" "}
                                            {!sub.activo &&
                                              "(inactiva)"}
                                          </div>
                                        </div>

                                        {checked && (
                                          <span
                                            className={
                                              styles.subBadge
                                            }
                                          >
                                            permitida
                                          </span>
                                        )}
                                      </label>
                                    );
                                  }
                                )
                              )}
                            </div>
                          </CampanaAccordion>
                        );
                      }
                    )
                  )}
                </div>

                <Pagination
                  page={
                    pagePermisosCampanas
                  }
                  totalPages={
                    totalPagesPermisos
                  }
                  totalItems={
                    campanasFiltradas.length
                  }
                  pageSize={
                    PAGE_SIZE_CAMPANAS
                  }
                  onPageChange={
                    setPagePermisosCampanas
                  }
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}