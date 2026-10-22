"use client";

import { useEffect, useMemo, useState } from "react";
import IconButton from "@/components/ui/IconButton";
import {
  crearDependencia,
  eliminarDependencia,
} from "@/lib/services/tareasService";
import type { Task } from "@/lib/types";
import styles from "./TaskModalDesarrollo.module.css";

type Props = {
  tarea: Task;
  puedeOperar: boolean;
  onTareaMutated?: () => void | Promise<void>;
};

export default function DependencyPanel({
  tarea,
  puedeOperar,
  onTareaMutated,
}: Props) {
  const [depBloqueada, setDepBloqueada] = useState<number | "">("");
  const [depBloqueadora, setDepBloqueadora] = useState<number | "">("");
  const [creando, setCreando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDepBloqueada("");
    setDepBloqueadora("");
    setMensaje(null);
    setError(null);
  }, [tarea.id]);

  const subtareasActivas = tarea.subtareas.filter((s) => s.activo !== false);

  const dependencias = useMemo(() => {
    const porId = new Map(tarea.subtareas.map((s) => [s.id, s]));
    return tarea.subtareas.flatMap((bloqueada) =>
      (bloqueada.bloqueada_por ?? []).map((bloqueadora) => ({
        key: `${bloqueada.id}-${bloqueadora.id}`,
        bloqueada,
        bloqueadora,
        codigoBloqueadora:
          bloqueadora.codigo ?? porId.get(bloqueadora.id)?.codigo ?? null,
      }))
    );
  }, [tarea.subtareas]);

  const agregarDependencia = async () => {
    if (depBloqueada === "" || depBloqueadora === "") {
      setError("Selecciona ambas subtareas.");
      setMensaje(null);
      return;
    }
    if (depBloqueada === depBloqueadora) {
      setError("Una subtarea no puede depender de sí misma.");
      setMensaje(null);
      return;
    }
    setError(null);
    setMensaje(null);
    setCreando(true);
    try {
      await crearDependencia(tarea.id, depBloqueada, depBloqueadora);
      setMensaje("Dependencia creada.");
      setDepBloqueada("");
      setDepBloqueadora("");
      await onTareaMutated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(false);
    }
  };

  const borrarDependencia = async (
    bloqueadaId: number,
    bloqueadoraId: number,
    descripcionBloqueada: string,
    descripcionBloqueadora: string
  ) => {
    const ok = window.confirm(
      `¿Eliminar la dependencia de "${descripcionBloqueada}" con "${descripcionBloqueadora}"?`
    );
    if (!ok) return;

    setError(null);
    setMensaje(null);
    setEliminando(`${bloqueadaId}-${bloqueadoraId}`);
    try {
      await eliminarDependencia(tarea.id, bloqueadaId, bloqueadoraId);
      setMensaje("Dependencia eliminada.");
      await onTareaMutated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div>
      {puedeOperar && subtareasActivas.length > 1 && (
        <div className={styles.dependencyEditor}>
          <h4 className={styles.dependencyTitle}>Crear dependencia</h4>
          <p className={styles.sectionHint}>
            Selecciona qué subtarea debe esperar a otra.
          </p>
          <div className={styles.dependencyRow}>
            <select
              value={depBloqueada}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setDepBloqueada(v);
                if (v !== "" && v === depBloqueadora) setDepBloqueadora("");
              }}
              className={styles.selectField}
              aria-label="Subtarea que depende de otra"
            >
              <option value="">— subtarea —</option>
              {subtareasActivas
                .filter((s) => s.id !== depBloqueadora)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo ? `${s.codigo} - ` : ""}
                    {s.descripcion.slice(0, 30)}
                  </option>
                ))}
            </select>
            <span className={styles.dependencyLabel}>depende de</span>
            <select
              value={depBloqueadora}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setDepBloqueadora(v);
                if (v !== "" && v === depBloqueada) setDepBloqueada("");
              }}
              className={styles.selectField}
              aria-label="Subtarea que debe solucionarse primero"
            >
              <option value="">— subtarea —</option>
              {subtareasActivas
                .filter((s) => s.id !== depBloqueada)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.codigo ? `${s.codigo} - ` : ""}
                    {s.descripcion.slice(0, 30)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => void agregarDependencia()}
              className={styles.addDependencyButton}
              disabled={creando}
            >
              {creando ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </div>
      )}


      <div className={styles.assignmentHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Lista de Dependencias</h3>
          <p className={styles.sectionHint}>
            Relaciones entre subtareas: la primera no puede avanzar hasta que
            la segunda esté solucionada.
          </p>
        </div>
      </div>

      {error && <p className={styles.errorNotice}>{error}</p>}
      {mensaje && <p className={styles.successNotice}>{mensaje}</p>}

      {dependencias.length === 0 ? (
        <p className={styles.mutedText}>Sin dependencias registradas.</p>
      ) : (
        <ul className={styles.dependencyList}>
          {dependencias.map((dep) => (
            <li key={dep.key} className={styles.dependencyItem}>
              <div className={styles.dependencyItemTitle}>
                {dep.bloqueada.codigo && (
                  <span className={styles.subtaskCode}>
                    {dep.bloqueada.codigo}
                  </span>
                )}
                <span>{dep.bloqueada.descripcion}</span>
                <span className={styles.dependencyLabel}>depende de</span>
                {dep.codigoBloqueadora && (
                  <span className={styles.subtaskCode}>
                    {dep.codigoBloqueadora}
                  </span>
                )}
                <span>{dep.bloqueadora.descripcion}</span>
              </div>
              <div className={styles.dependencyItemMeta}>
                <span>{dep.bloqueadora.estado}</span>
                {puedeOperar && (
                  <IconButton
                    icon="trash"
                    variant="danger"
                    title="Eliminar dependencia"
                    disabled={eliminando === dep.key || dep.bloqueadora.estado == 'SOLUCIONADO'}
                    onClick={() =>
                      void borrarDependencia(
                        dep.bloqueada.id,
                        dep.bloqueadora.id,
                        dep.bloqueada.descripcion,
                        dep.bloqueadora.descripcion
                      )
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}


    </div>
  );
}
