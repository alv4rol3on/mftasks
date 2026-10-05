"use client";

import { useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import SearchableSelect, {
  SearchableOption,
} from "@/components/ui/SearchableSelect";

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
  campanas: CampanaPerm[];
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
};

export default function CampanaModal({ campanas, onClose, onSaved }: Props) {
  const [tipoCreacion, setTipoCreacion] = useState<"campana" | "subcampana">(
    "campana"
  );
  const [nuevaCampanaNombre, setNuevaCampanaNombre] = useState("");
  const [nuevaSubcampana, setNuevaSubcampana] = useState({
    campanaId: "",
    nombre: "",
  });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcampanasPadre = useMemo(() => {
    if (!nuevaSubcampana.campanaId) return [];
    const padre = campanas.find(
      (c) => String(c.id) === nuevaSubcampana.campanaId
    );
    return padre?.subcampanas ?? [];
  }, [campanas, nuevaSubcampana.campanaId]);

  const sugerenciasCampana = useMemo(
    () => nombresSimilares(nuevaCampanaNombre, campanas),
    [nuevaCampanaNombre, campanas]
  );

  const campanaDuplicada = useMemo(
    () => Boolean(existeNombreNormalizado(nuevaCampanaNombre, campanas)),
    [nuevaCampanaNombre, campanas]
  );

  const sugerenciasSubcampana = useMemo(
    () => nombresSimilares(nuevaSubcampana.nombre, subcampanasPadre),
    [nuevaSubcampana.nombre, subcampanasPadre]
  );

  const subcampanaDuplicada = useMemo(
    () =>
      Boolean(
        existeNombreNormalizado(nuevaSubcampana.nombre, subcampanasPadre)
      ),
    [nuevaSubcampana.nombre, subcampanasPadre]
  );

  const opcionesCampana: SearchableOption[] = useMemo(
    () =>
      campanas.map((campana) => ({
        value: String(campana.id),
        label: `${campana.nombre} (${campana.codigo})`,
        sublabel: campana.activo ? undefined : "inactiva",
      })),
    [campanas]
  );

  const puedeCrear =
    tipoCreacion === "campana"
      ? Boolean(nuevaCampanaNombre.trim()) && !campanaDuplicada
      : Boolean(nuevaSubcampana.campanaId) &&
        Boolean(nuevaSubcampana.nombre.trim()) &&
        !subcampanaDuplicada;

  const crearCampana = async () => {
    if (!nuevaCampanaNombre.trim()) {
      setError("El nombre de la campaña es obligatorio.");
      return;
    }
    if (campanaDuplicada) {
      setError("Ya existe una campaña con un nombre igual o similar.");
      return;
    }

    setCreando(true);
    setError(null);
    try {
      await apiFetch("/api/campanas/campanas/", {
        method: "POST",
        body: JSON.stringify({ nombre: nuevaCampanaNombre.trim() }),
      });
      await onSaved(`Campaña "${nuevaCampanaNombre.trim()}" creada`);
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
      setError(
        "Ya existe una subcampaña con ese nombre en la campaña seleccionada."
      );
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

  const footer = (
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
        onClick={tipoCreacion === "campana" ? crearCampana : crearSubcampana}
        disabled={creando || !puedeCrear}
      >
        {creando
          ? "Creando..."
          : tipoCreacion === "campana"
            ? "Crear campaña"
            : "Crear subcampaña"}
      </button>
    </>
  );

  return (
    <Modal
      title="Registrar campaña / subcampaña"
      onClose={onClose}
      footer={footer}
    >
      <div className={styles.createToggle}>
        <button
          type="button"
          onClick={() => setTipoCreacion("campana")}
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
          onClick={() => setTipoCreacion("subcampana")}
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
        <div className={styles.createForm} style={{ maxWidth: "100%" }}>
          <div className={styles.createField} style={{ position: "relative" }}>
            <label style={{ color: "black" }}>Nombre campaña *</label>

            <input
              placeholder="Ej: BBVA, CSC, BCP..."
              value={nuevaCampanaNombre}
              onChange={(e) => setNuevaCampanaNombre(e.target.value)}
              className={styles.input}
            />

            {campanaDuplicada && (
              <div className={styles.dupWarning}>
                Ya existe una campaña con ese nombre.
              </div>
            )}

            {!campanaDuplicada && sugerenciasCampana.length > 0 && (
              <div className={styles.sugerencias}>
                <div className={styles.sugerenciasTitle}>
                  Campañas existentes similares:
                </div>
                {sugerenciasCampana.map((c) => (
                  <div key={c.id} className={styles.sugerenciaItem}>
                    {c.nombre}{" "}
                    <span className={styles.sugerenciaCode}>({c.codigo})</span>{" "}
                    {!c.activo && "— inactiva"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.createForm} style={{ maxWidth: "100%" }}>
          <div className={styles.createField}>
            <label style={{ color: "black" }}>Campaña padre *</label>
            <SearchableSelect
              value={nuevaSubcampana.campanaId}
              onChange={(v) =>
                setNuevaSubcampana({ ...nuevaSubcampana, campanaId: v })
              }
              options={opcionesCampana}
              placeholder="Buscar campaña por nombre o código..."
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
                Ya existe una subcampaña con ese nombre en la campaña
                seleccionada.
              </div>
            )}

            {!subcampanaDuplicada && sugerenciasSubcampana.length > 0 && (
              <div className={styles.sugerencias}>
                <div className={styles.sugerenciasTitle}>
                  Subcampañas existentes similares:
                </div>
                {sugerenciasSubcampana.map((s) => (
                  <div key={s.id} className={styles.sugerenciaItem}>
                    {s.nombre}{" "}
                    <span className={styles.sugerenciaCode}>({s.codigo})</span>{" "}
                    {!s.activo && "— inactiva"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
