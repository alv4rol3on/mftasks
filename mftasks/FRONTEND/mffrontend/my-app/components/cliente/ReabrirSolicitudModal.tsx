"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Task } from "@/lib/types";
import Modal from "@/components/ui/Modal";

type Props = {
  tarea: Task;
  onClose: () => void;
  onSaved: (tarea: Task) => void;
};

const MAX_REAPERTURAS = 2;

export default function ReabrirSolicitudModal({
  tarea,
  onClose,
  onSaved,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const restantes = Math.max(
    0,
    MAX_REAPERTURAS - (tarea.reaperturas_cliente ?? 0)
  );

  const reabrir = async () => {
    if (!motivo.trim()) {
      setError("El motivo de reapertura es obligatorio.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const actualizada = await apiFetch<Task>(
        `/api/tasks/tasks/${tarea.id}/reabrir/`,
        {
          method: "POST",
          body: JSON.stringify({ motivo: motivo.trim() }),
        }
      );
      onSaved(actualizada);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      title="Reabrir solicitud"
      onClose={enviando ? () => {} : onClose}
      maxWidth={560}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            style={{
              background: "var(--color-background)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void reabrir()}
            disabled={enviando || restantes === 0}
            style={{
              background: "var(--color-waiting)",
              color: "var(--color-on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando || restantes === 0 ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {enviando ? "Reabriendo…" : "Reabrir solicitud"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)" }}>
        La solicitud <strong>{tarea.ticket ?? `#${tarea.id}`}</strong> volverá a
        estado <strong>En desarrollo</strong> y se creará una subtarea de
        reapertura para el líder del equipo.
      </p>
      <p style={{ margin: "8px 0 12px", fontSize: 12, color: "var(--color-text-secondary)" }}>
        Reaperturas restantes: <strong>{restantes}</strong> de {MAX_REAPERTURAS}.
      </p>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Motivo de reapertura *
        </span>
        <textarea
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError(null);
          }}
          rows={4}
          maxLength={2000}
          placeholder="Explica por qué la solución no fue satisfactoria"
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            background: "var(--color-background)",
            color: "var(--color-text)",
          }}
          disabled={enviando}
        />
      </label>

      {error && (
        <p role="alert" style={{ margin: "10px 0 0", color: "var(--color-danger)", fontSize: 12 }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
