"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import Pagination from "@/components/ui/Pagination";
import IconButton from "@/components/ui/IconButton";

import styles from "./AdminSections.module.css";
import CampanaModal from "./CampanaModal";
import EditarNombreModal, {
  type TipoNombre,
} from "./EditarNombreModal";
import AccionesCatalogoModal, {
  type AccionCatalogo,
} from "./AccionesCatalogoModal";

type Subcampana = {
  id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
  eliminado: boolean;
  campana: number;
  fecha_eliminacion?: string | null;
};

type EntidadPerm = {
  id: number;
  nombre: string;
  activo: boolean;
  eliminado: boolean;
  fecha_eliminacion?: string | null;
};

type CampanaPerm = {
  id: number;
  entidad: number;
  entidad_nombre: string;
  nombre: string;
  codigo: string;
  subcampanas: Subcampana[];
  activo: boolean;
  eliminado: boolean;
  fecha_eliminacion?: string | null;
};

type Props = {
  setMsg: (msg: string | null) => void;
};

const PAGE_SIZE_CAMPANAS = 6;

type EditTarget = {
  tipo: TipoNombre;
  id: number;
  nombre: string;
};

type AccionesTarget = {
  tipo: TipoNombre;
  id: number;
  nombre: string;
  eliminado: boolean;
};

export default function CampanasSection({ setMsg }: Props) {
  const [campanas, setCampanas] = useState<CampanaPerm[]>([]);
  const [entidades, setEntidades] = useState<EntidadPerm[]>([]);
  const [accionEnCurso, setAccionEnCurso] = useState(false);

  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroEntidad, setFiltroEntidad] = useState("");

  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());

  const [pageCampanas, setPageCampanas] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [accionesTarget, setAccionesTarget] =
    useState<AccionesTarget | null>(null);

  const nombresExistentes = (() => {
    if (!editTarget) return [];

    if (editTarget.tipo === "entidad") {
      return entidades.filter(
        (entidad) => entidad.id !== editTarget.id && !entidad.eliminado
      );
    }

    if (editTarget.tipo === "campana") {
      const campana = campanas.find(
        (item) => item.id === editTarget.id
      );

      if (!campana) return [];

      return campanas.filter(
        (item) =>
          item.entidad === campana.entidad &&
          item.id !== campana.id &&
          !item.eliminado
      );
    }

    for (const campana of campanas) {
      const sub = campana.subcampanas.find(
        (item) => item.id === editTarget.id
      );

      if (sub) {
        return campana.subcampanas.filter(
          (item) => item.id !== sub.id && !item.eliminado
        );
      }
    }

    return [];
  })();

  // --------------------------------------------------
  // CARGAR CAMPAÑAS
  // --------------------------------------------------

  const cargarCampanas = async () => {
    try {
      const [data, dataEntidades] = await Promise.all([
        apiFetch<CampanaPerm[] | { results: CampanaPerm[] }>(
          "/api/campanas/campanas/"
        ),
        apiFetch<EntidadPerm[] | { results: EntidadPerm[] }>(
          "/api/entidades/entidades/"
        ),
      ]);

      const arr = Array.isArray(data) ? data : data.results ?? [];
      const arrEntidades = Array.isArray(dataEntidades)
        ? dataEntidades
        : dataEntidades.results ?? [];

      setCampanas(arr);
      setEntidades(arrEntidades);
    } catch {
      setCampanas([]);
      setEntidades([]);
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

  // --------------------------------------------------
  // FILTROS
  // --------------------------------------------------

  const campanasFiltradas = campanas.filter(campana => {
    if (filtroEntidad && String(campana.entidad) !== filtroEntidad) {
      return false;
    }

    if (!filtroCampana) {
      return true;
    }

    const q = filtroCampana.toLowerCase();

    return (
      campana.nombre.toLowerCase().includes(q) ||
      (campana.entidad_nombre ?? "").toLowerCase().includes(q) ||
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

  const expandirTodas = () => {
    setExpandidas(new Set(campanasPaginadas.map(campana => campana.id)));
  };

  const colapsarTodas = () => {
    setExpandidas(new Set());
  };

  useEffect(() => {
    setPageCampanas(1);
  }, [filtroCampana, filtroEntidad]);

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

  // --------------------------------------------------
  // ACCIONES
  // --------------------------------------------------

  const abrirAcciones = (target: AccionesTarget) => {
    setAccionesTarget(target);
  };

  const abrirAccionesEntidad = (entidad: EntidadPerm) => {
    abrirAcciones({
      tipo: "entidad",
      id: entidad.id,
      nombre: entidad.nombre,
      eliminado: entidad.eliminado,
    });
  };

  const abrirAccionesCampana = (campana: CampanaPerm) => {
    abrirAcciones({
      tipo: "campana",
      id: campana.id,
      nombre: campana.nombre,
      eliminado: campana.eliminado,
    });
  };

  const abrirAccionesSubcampana = (sub: Subcampana) => {
    abrirAcciones({
      tipo: "subcampana",
      id: sub.id,
      nombre: sub.nombre,
      eliminado: sub.eliminado,
    });
  };

  const endpointCatalogo = (tipo: TipoNombre, id: number) => {
    if (tipo === "entidad") return `/api/entidades/entidades/${id}/`;
    if (tipo === "campana") return `/api/campanas/campanas/${id}/`;
    return `/api/campanas/subcampanas/${id}/`;
  };

  const eliminar = async (target: AccionesTarget) => {
    const detalleCascada =
      target.tipo === "entidad"
        ? " Se eliminarán lógicamente sus campañas y subcampañas."
        : " Las solicitudes históricas se conservan.";

    if (
      !confirm(
        `Eliminar ${target.nombre}?${detalleCascada}`
      )
    ) {
      return;
    }

    setAccionEnCurso(true);
    try {
      await apiFetch<{ detalle?: string }>(
        endpointCatalogo(target.tipo, target.id),
        { method: "DELETE" }
      );
      const etiqueta =
        target.tipo === "entidad"
          ? "Entidad"
          : target.tipo === "campana"
            ? "Campaña"
            : "Subcampaña";
      setMsg(`${etiqueta} eliminada`);
      setAccionesTarget(null);
      await cargarCampanas();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setAccionEnCurso(false);
    }
  };

  const accionesModal: AccionCatalogo[] = (() => {
    const target = accionesTarget;
    if (!target) return [];

    return [
      {
        etiqueta: "Editar nombre",
        onClick: () => {
          setAccionesTarget(null);
          setEditTarget({
            tipo: target.tipo,
            id: target.id,
            nombre: target.nombre,
          });
        },
      },
      {
        etiqueta: "Eliminar",
        tono: "danger",
        onClick: () => eliminar(target),
      },
    ];
  })();

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.container}>
      {/* ESTADOS DE CAMPAÑAS */}

      <div className={styles.card}>
        <div className={styles.usersHeader}>
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>
            Entidades / Campañas / Subcampañas
          </h3>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setModalOpen(true)}
          >
            + Crear
          </button>
        </div>

        {entidades.length > 0 && (
          <div className={styles.entidadesBlock}>
            <div className={styles.entidadesTitle}>Entidades</div>

            <div className={styles.entidadesList}>
              {entidades.map((entidad) => (
                <span
                  key={entidad.id}
                  className={styles.entidadChip}
                >
                  <span>{entidad.nombre}</span>

                  <IconButton
                    icon="settings"
                    size={14}
                    variant="primary"
                    title={`Acciones de la entidad ${entidad.nombre}`}
                    onClick={() => abrirAccionesEntidad(entidad)}
                  />
                </span>
              ))}
            </div>
          </div>
        )}

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

          <div className={styles.permisosField} style={{ maxWidth: 260 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Entidad</label>
            <select
              value={filtroEntidad}
              onChange={(e) => setFiltroEntidad(e.target.value)}
              className={styles.select}
            >
              <option value="">Todas las entidades</option>
              {entidades.map((entidad) => (
                <option key={entidad.id} value={entidad.id}>
                  {entidad.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {campanasFiltradas.length > PAGE_SIZE_CAMPANAS && (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
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
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              No hay campañas que coincidan.
            </div>
          ) : (
            campanasPaginadas.map(camp => {
              const abierta = expandidas.has(camp.id);
              const subcampanasVisibles = camp.subcampanas;

              return (
                <div
                  key={camp.id}
                  className={styles.campanaCard}
                >
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
                    <div className={styles.campanaTitleWrap}>
                      <span className={styles.campanaTitle}>
                        {camp.entidad_nombre}
                      </span>

                      <span className={styles.campanaTitleSep}>·</span>

                      <span className={styles.campanaTitle}>
                        {camp.nombre}
                      </span>
                    </div>

                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <IconButton
                          icon="settings"
                          size={14}
                          variant="info"
                          title={`Acciones de la campaña ${camp.nombre}`}
                          onClick={() => abrirAccionesCampana(camp)}
                        />
                      </span>

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
                        {subcampanasVisibles.length === 0 ? (
                          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                            Sin subcampañas
                          </span>
                        ) : (
                          subcampanasVisibles.map(sub => (
                            <div
                              key={sub.id}
                              className={styles.subLabel}
                              style={{
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
                                  {sub.codigo}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <IconButton
                                  icon="settings"
                                  size={14}
                                  variant="info"
                                  title={`Acciones de la subcampaña ${sub.nombre}`}
                                  onClick={() =>
                                    abrirAccionesSubcampana(sub)
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
          entidades={entidades.filter((entidad) => !entidad.eliminado)}
          campanas={campanas
            .filter((campana) => !campana.eliminado)
            .map((campana) => ({
              ...campana,
              subcampanas: campana.subcampanas.filter(
                (sub) => !sub.eliminado
              ),
            }))}
          onClose={() => setModalOpen(false)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarCampanas();
          }}
        />
      )}

      {editTarget && (
        <EditarNombreModal
          key={`${editTarget.tipo}-${editTarget.id}`}
          tipo={editTarget.tipo}
          id={editTarget.id}
          nombreActual={editTarget.nombre}
          nombresExistentes={nombresExistentes}
          onClose={() => setEditTarget(null)}
          onSaved={async (m) => {
            setMsg(m);
            await cargarCampanas();
          }}
        />
      )}

      {accionesTarget && (
        <AccionesCatalogoModal
          titulo={`Acciones · ${accionesTarget.nombre}`}
          subtitulo="Edita el nombre, cambia su disponibilidad o elimínalo dejando rastro para el historial."
          acciones={accionesModal}
          onClose={() => setAccionesTarget(null)}
          ocupado={accionEnCurso}
        />
      )}
    </div>
  );
}
