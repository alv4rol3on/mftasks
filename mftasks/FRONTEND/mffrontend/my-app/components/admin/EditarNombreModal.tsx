"use client";

import { useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import { normalizarNombre } from "@/lib/similitud";

import styles from "./AdminSections.module.css";

export type TipoNombre = "entidad" | "campana" | "subcampana";

type Props = {
  tipo: TipoNombre;
  id: number;
  nombreActual: string;
  nombresExistentes?: { id: number; nombre: string }[];
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
};

const CONFIG: Record<
  TipoNombre,
  { etiqueta: string; endpoint: (id: number) => string }
> = {
  entidad: {
    etiqueta: "entidad",
    endpoint: (id) => `/api/entidades/entidades/${id}/`,
  },
  campana: {
    etiqueta: "campaña",
    endpoint: (id) => `/api/campanas/campanas/${id}/`,
  },
  subcampana: {
    etiqueta: "subcampaña",
    endpoint: (id) => `/api/campanas/subcampanas/${id}/`,
  },
};

export default function EditarNombreModal({
  tipo,
  id,
  nombreActual,
  nombresExistentes = [],
  onClose,
  onSaved,
}: Props) {
  const { etiqueta, endpoint } = CONFIG[tipo];

  const [nombre, setNombre] = useState(nombreActual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombreLimpio = nombre.trim();

  const duplicado = useMemo(() => {
    if (!nombreLimpio) return null;

    const objetivo = normalizarNombre(nombreLimpio);

    return (
      nombresExistentes.find(
        (item) => item.id !== id && normalizarNombre(item.nombre) === objetivo
      ) ?? null
    );
  }, [nombreLimpio, nombresExistentes, id]);

  const sinCambios = nombreLimpio === nombreActual.trim();

  const guardar = async () => {
    if (!nombreLimpio) {
      setError(`El nombre de la ${etiqueta} es obligatorio.`);
      return;
    }

    if (duplicado) {
      setError(
        `Ya existe una ${etiqueta} con ese nombre: "${duplicado.nombre}".`
      );
      return;
    }

    if (sinCambios) {
      onClose();
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch(endpoint(id), {
        method: "PATCH",
        body: JSON.stringify({ nombre: nombreLimpio }),
      });

      await onSaved(
        `Nombre de ${etiqueta} actualizado a "${nombreLimpio}".`
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      title={`Editar nombre de ${etiqueta}`}
      onClose={onClose}
      maxWidth={520}
      footer={
        <>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={guardar}
            disabled={guardando || Boolean(duplicado) || !nombreLimpio}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      }
    >
      <div className={styles.createForm} style={{ maxWidth: "100%" }}>
        <div className={styles.createField}>
          <label htmlFor={`nombre-${tipo}-${id}`}>
            Nombre actual: {nombreActual}
          </label>
          <input
            id={`nombre-${tipo}-${id}`}
            autoFocus
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                guardar();
              }
            }}
            className={styles.input}
          />
        </div>

        {duplicado && (
          <div className={styles.dupWarning}>
            Ya existe una {etiqueta} con ese nombre.
          </div>
        )}

        {error && (
          <div className={`${styles.msg} ${styles.msgError}`}>{error}</div>
        )}
      </div>
    </Modal>
  );
}
