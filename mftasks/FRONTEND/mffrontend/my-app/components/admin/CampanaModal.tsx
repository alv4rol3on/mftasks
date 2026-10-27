"use client";

import { useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import SearchableSelect, {
  SearchableOption,
} from "@/components/ui/SearchableSelect";
import type { CampanaInfo, EntidadInfo, SubCampanaInfo } from "@/lib/types";

import {
  existeNombreNormalizado,
  nombresSimilares,
} from "@/lib/similitud";

import styles from "./AdminSections.module.css";

type Props = {
  entidades: EntidadInfo[];
  campanas: CampanaInfo[];
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
};

type TipoCreacion = "entidad" | "campana" | "subcampana";

export default function CampanaModal({
  entidades,
  campanas,
  onClose,
  onSaved,
}: Props) {
  const [tipoCreacion, setTipoCreacion] = useState<TipoCreacion>("entidad");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nuevaEntidad, setNuevaEntidad] = useState({
    nombre: "",
    razon_social: "",
    ruc: "",
    correo: "",
    telefono: "",
    direccion: "",
  });

  const [nuevaCampana, setNuevaCampana] = useState({
    entidadId: "",
    nombre: "",
  });

  const [nuevaSubcampana, setNuevaSubcampana] = useState({
    campanaId: "",
    nombre: "",
  });

  const campanasDeEntidad = useMemo(() => {
    if (!nuevaCampana.entidadId) return [];
    return campanas.filter(
      (campana) => String(campana.entidad) === nuevaCampana.entidadId
    );
  }, [campanas, nuevaCampana.entidadId]);

  const subcampanasPadre = useMemo(() => {
    if (!nuevaSubcampana.campanaId) return [] as SubCampanaInfo[];
    const padre = campanas.find(
      (campana) => String(campana.id) === nuevaSubcampana.campanaId
    );
    return padre?.subcampanas ?? [];
  }, [campanas, nuevaSubcampana.campanaId]);

  const entidadDuplicada = useMemo(
    () =>
      Boolean(
        existeNombreNormalizado(nuevaEntidad.nombre, entidades)
      ),
    [nuevaEntidad.nombre, entidades]
  );

  const sugerenciasEntidad = useMemo(
    () => nombresSimilares(nuevaEntidad.nombre, entidades),
    [nuevaEntidad.nombre, entidades]
  );

  const campanaDuplicada = useMemo(
    () =>
      Boolean(
        existeNombreNormalizado(nuevaCampana.nombre, campanasDeEntidad)
      ),
    [nuevaCampana.nombre, campanasDeEntidad]
  );

  const sugerenciasCampana = useMemo(
    () => nombresSimilares(nuevaCampana.nombre, campanasDeEntidad),
    [nuevaCampana.nombre, campanasDeEntidad]
  );

  const subcampanaDuplicada = useMemo(
    () =>
      Boolean(
        existeNombreNormalizado(nuevaSubcampana.nombre, subcampanasPadre)
      ),
    [nuevaSubcampana.nombre, subcampanasPadre]
  );

  const sugerenciasSubcampana = useMemo(
    () => nombresSimilares(nuevaSubcampana.nombre, subcampanasPadre),
    [nuevaSubcampana.nombre, subcampanasPadre]
  );

  const opcionesEntidad: SearchableOption[] = useMemo(
    () =>
      entidades.map((entidad) => ({
        value: String(entidad.id),
        label: entidad.nombre,
        sublabel: entidad.activo ? undefined : "inactiva",
      })),
    [entidades]
  );

  const puedeCrear =
    tipoCreacion === "entidad"
      ? Boolean(nuevaEntidad.nombre.trim()) && !entidadDuplicada
      : tipoCreacion === "campana"
        ? Boolean(nuevaCampana.entidadId) &&
          Boolean(nuevaCampana.nombre.trim()) &&
          !campanaDuplicada
        : Boolean(nuevaSubcampana.campanaId) &&
          Boolean(nuevaSubcampana.nombre.trim()) &&
          !subcampanaDuplicada;

  const crearEntidad = async () => {
    if (!nuevaEntidad.nombre.trim()) {
      setError("El nombre de la entidad es obligatorio.");
      return;
    }
    if (entidadDuplicada) {
      setError("Ya existe una entidad con un nombre igual o similar.");
      return;
    }

    setCreando(true);
    setError(null);
    try {
      await apiFetch("/api/entidades/entidades/", {
        method: "POST",
        body: JSON.stringify({
          nombre: nuevaEntidad.nombre.trim(),
          razon_social: nuevaEntidad.razon_social.trim(),
          ruc: nuevaEntidad.ruc.trim() || null,
          correo: nuevaEntidad.correo.trim(),
          telefono: nuevaEntidad.telefono.trim(),
          direccion: nuevaEntidad.direccion.trim(),
        }),
      });
      await onSaved(`Entidad "${nuevaEntidad.nombre.trim()}" creada`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(false);
    }
  };

  const crearCampana = async () => {
    if (!nuevaCampana.entidadId) {
      setError("Selecciona una entidad.");
      return;
    }
    if (!nuevaCampana.nombre.trim()) {
      setError("El nombre de la campaña es obligatorio.");
      return;
    }
    if (campanaDuplicada) {
      setError("Ya existe una campaña con ese nombre en la entidad.");
      return;
    }

    setCreando(true);
    setError(null);
    try {
      await apiFetch("/api/campanas/campanas/", {
        method: "POST",
        body: JSON.stringify({
          entidad: Number(nuevaCampana.entidadId),
          nombre: nuevaCampana.nombre.trim(),
        }),
      });
      await onSaved(`Campaña "${nuevaCampana.nombre.trim()}" creada`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(false);
    }
  };

  const crearSubcampana = async () => {
    if (!nuevaSubcampana.campanaId) {
      setError("Selecciona una campaña padre.");
      return;
    }
    if (!nuevaSubcampana.nombre.trim()) {
      setError("El nombre de la subcampaña es obligatorio.");
      return;
    }
    if (subcampanaDuplicada) {
      setError("Ya existe una subcampaña con ese nombre en la campaña.");
      return;
    }

    setCreando(true);
    setError(null);
    try {
      await apiFetch("/api/campanas/subcampanas/", {
        method: "POST",
        body: JSON.stringify({
          campana: Number(nuevaSubcampana.campanaId),
          nombre: nuevaSubcampana.nombre.trim(),
        }),
      });
      await onSaved(`Subcampaña "${nuevaSubcampana.nombre.trim()}" creada`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(false);
    }
  };

  const crear = () => {
    if (tipoCreacion === "entidad") return crearEntidad();
    if (tipoCreacion === "campana") return crearCampana();
    return crearSubcampana();
  };

  return (
    <Modal
      title="Registrar entidad, campaña o subcampaña"
      onClose={onClose}
      maxWidth={720}
      footer={
        <>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={creando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={crear}
            disabled={creando || !puedeCrear}
          >
            {creando
              ? "Creando..."
              : tipoCreacion === "entidad"
                ? "Crear entidad"
                : tipoCreacion === "campana"
                  ? "Crear campaña"
                  : "Crear subcampaña"}
          </button>
        </>
      }
    >
      <div className={styles.createToggle}>
        {(["entidad", "campana", "subcampana"] as TipoCreacion[]).map(
          (tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setTipoCreacion(tipo);
                setError(null);
              }}
              className={
                tipoCreacion === tipo
                  ? styles.createToggleActive
                  : styles.createToggleBtn
              }
            >
              {tipo === "entidad"
                ? "Nueva entidad"
                : tipo === "campana"
                  ? "Nueva campaña"
                  : "Nueva subcampaña"}
            </button>
          )
        )}
      </div>

      {tipoCreacion === "entidad" && (
        <div className={styles.createForm} style={{ maxWidth: "100%" }}>
          <div className={styles.createField} style={{ position: "relative" }}>
            <label style={{ color: "black" }}>Nombre entidad *</label>
            <input
              placeholder="Ej: BBVA, Scotiabank..."
              value={nuevaEntidad.nombre}
              onChange={(e) =>
                setNuevaEntidad({ ...nuevaEntidad, nombre: e.target.value })
              }
              className={styles.input}
            />
            {entidadDuplicada && (
              <div className={styles.dupWarning}>
                Ya existe una entidad con ese nombre.
              </div>
            )}
            {!entidadDuplicada && sugerenciasEntidad.length > 0 && (
              <div className={styles.sugerencias}>
                <div className={styles.sugerenciasTitle}>
                  Entidades existentes similares:
                </div>
                {sugerenciasEntidad.map((entidad) => (
                  <div key={entidad.id} className={styles.sugerenciaItem}>
                    {entidad.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Razón social</label>
            <input
              value={nuevaEntidad.razon_social}
              onChange={(e) =>
                setNuevaEntidad({
                  ...nuevaEntidad,
                  razon_social: e.target.value,
                })
              }
              className={styles.input}
            />
          </div>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>RUC</label>
            <input
              value={nuevaEntidad.ruc}
              onChange={(e) =>
                setNuevaEntidad({ ...nuevaEntidad, ruc: e.target.value })
              }
              className={styles.input}
            />
          </div>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Correo</label>
            <input
              type="email"
              value={nuevaEntidad.correo}
              onChange={(e) =>
                setNuevaEntidad({ ...nuevaEntidad, correo: e.target.value })
              }
              className={styles.input}
            />
          </div>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Teléfono</label>
            <input
              value={nuevaEntidad.telefono}
              onChange={(e) =>
                setNuevaEntidad({ ...nuevaEntidad, telefono: e.target.value })
              }
              className={styles.input}
            />
          </div>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Dirección</label>
            <input
              value={nuevaEntidad.direccion}
              onChange={(e) =>
                setNuevaEntidad({ ...nuevaEntidad, direccion: e.target.value })
              }
              className={styles.input}
            />
          </div>
        </div>
      )}

      {tipoCreacion === "campana" && (
        <div className={styles.createForm} style={{ maxWidth: "100%" }}>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Entidad *</label>
            <SearchableSelect
              value={nuevaCampana.entidadId}
              onChange={(value) =>
                setNuevaCampana({ entidadId: value, nombre: "" })
              }
              options={opcionesEntidad}
              placeholder="Buscar entidad..."
            />
          </div>
          <div className={styles.createField} style={{ position: "relative" }}>
            <label style={{ color: "black" }}>Nombre campaña *</label>
            <input
              placeholder="Ej: Campaña Outbound"
              value={nuevaCampana.nombre}
              onChange={(e) =>
                setNuevaCampana({ ...nuevaCampana, nombre: e.target.value })
              }
              className={styles.input}
            />
            {campanaDuplicada && (
              <div className={styles.dupWarning}>
                Ya existe una campaña con ese nombre en la entidad.
              </div>
            )}
            {!campanaDuplicada && sugerenciasCampana.length > 0 && (
              <div className={styles.sugerencias}>
                <div className={styles.sugerenciasTitle}>
                  Campañas existentes similares:
                </div>
                {sugerenciasCampana.map((campana) => (
                  <div key={campana.id} className={styles.sugerenciaItem}>
                    {campana.nombre}{" "}
                    <span className={styles.sugerenciaCode}>
                      ({campana.codigo})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tipoCreacion === "subcampana" && (
        <div className={styles.createForm} style={{ maxWidth: "100%" }}>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Campaña padre *</label>
            <SearchableSelect
              value={nuevaSubcampana.campanaId}
              onChange={(value) =>
                setNuevaSubcampana({ campanaId: value, nombre: "" })
              }
              options={campanas.map((campana) => ({
                value: String(campana.id),
                label: `${campana.entidad_nombre ?? ""} · ${campana.nombre}`,
                sublabel: campana.activo ? undefined : "inactiva",
              }))}
              placeholder="Buscar campaña..."
            />
          </div>
          <div className={styles.createField} style={{ position: "relative" }}>
            <label style={{ color: "black" }}>Nombre subcampaña *</label>
            <input
              placeholder="Ej: Tarjetas Out, Digital..."
              value={nuevaSubcampana.nombre}
              onChange={(e) =>
                setNuevaSubcampana({
                  ...nuevaSubcampana,
                  nombre: e.target.value,
                })
              }
              className={styles.input}
            />
            <span className={styles.createHint}>
              El código se genera como CODIGO_CAMPANA_NOMBRE.
            </span>
            {subcampanaDuplicada && (
              <div className={styles.dupWarning}>
                Ya existe una subcampaña con ese nombre en la campaña.
              </div>
            )}
            {!subcampanaDuplicada && sugerenciasSubcampana.length > 0 && (
              <div className={styles.sugerencias}>
                <div className={styles.sugerenciasTitle}>
                  Subcampañas existentes similares:
                </div>
                {sugerenciasSubcampana.map((subcampana) => (
                  <div key={subcampana.id} className={styles.sugerenciaItem}>
                    {subcampana.nombre}{" "}
                    <span className={styles.sugerenciaCode}>
                      ({subcampana.codigo})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          className={`${styles.msg} ${styles.msgError}`}
          style={{ marginTop: 12 }}
        >
          {error}
        </div>
      )}
    </Modal>
  );
}
