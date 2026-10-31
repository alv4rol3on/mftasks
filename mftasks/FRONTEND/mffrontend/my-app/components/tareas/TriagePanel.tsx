"use client";

import { useEffect, useState } from "react";
import { actualizarTriage } from "@/lib/services/tareasService";
import type { Task } from "@/lib/types";
import styles from "./TareaDetalle.module.css";

type Props = {
  tarea: Task;
  onSaved: () => void | Promise<void>;
};

const OPCIONES = {
  prioridad: [
    { value: "BAJA", label: "Baja" },
    { value: "MEDIA", label: "Media" },
    { value: "ALTA", label: "Alta" },
    { value: "URGENTE", label: "Urgente" },
  ],
  severidad: [
    { value: "BAJA", label: "Baja" },
    { value: "MEDIA", label: "Media" },
    { value: "ALTA", label: "Alta" },
    { value: "CRITICA", label: "Crítica" },
  ],
  impacto: [
    { value: "BAJO", label: "Bajo" },
    { value: "MEDIO", label: "Medio" },
    { value: "ALTO", label: "Alto" },
    { value: "CRITICO", label: "Crítico" },
  ],
};

export default function TriagePanel({ tarea, onSaved }: Props) {
  const [prioridad, setPrioridad] = useState<string>(tarea.prioridad ?? "MEDIA");
  const [severidad, setSeveridad] = useState<string>(tarea.severidad ?? "MEDIA");
  const [impacto, setImpacto] = useState<string>(tarea.impacto ?? "MEDIO");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrioridad(tarea.prioridad ?? "MEDIA");
    setSeveridad(tarea.severidad ?? "MEDIA");
    setImpacto(tarea.impacto ?? "MEDIO");
    setError(null);
    setMensaje(null);
  }, [tarea.id, tarea.prioridad, tarea.severidad, tarea.impacto]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await actualizarTriage(tarea.id, { prioridad, severidad, impacto });
      setMensaje("Triage actualizado.");
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div className={styles.assignmentHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Triage de la solicitud</h3>
          <p className={styles.sectionHint}>
            El cliente propone una clasificación inicial. Como líder del equipo
            puedes ajustar prioridad, severidad e impacto.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, maxWidth: 760 }}>
        <label className={styles.dialogField}>
          <span>Prioridad</span>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
            className={styles.selectField}
            disabled={guardando}
          >
            {OPCIONES.prioridad.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.dialogField}>
          <span>Severidad</span>
          <select
            value={severidad}
            onChange={(e) => setSeveridad(e.target.value)}
            className={styles.selectField}
            disabled={guardando}
          >
            {OPCIONES.severidad.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.dialogField}>
          <span>Impacto</span>
          <select
            value={impacto}
            onChange={(e) => setImpacto(e.target.value)}
            className={styles.selectField}
            disabled={guardando}
          >
            {OPCIONES.impacto.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void guardar()}
          disabled={guardando}
        >
          {guardando ? "Guardando…" : "Guardar triage"}
        </button>
        {mensaje && <span className={styles.successNotice} style={{ margin: 0 }}>{mensaje}</span>}
        {error && <span className={styles.errorNotice} style={{ margin: 0 }}>{error}</span>}
      </div>
    </div>
  );
}
