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

const fmt = (fecha?: string | null) => {
  if (!fecha) return "-";
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function ConfirmarSolucionModal({
  tarea,
  onClose,
  onSaved,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const actualizada = await apiFetch<Task>(
        `/api/tasks/tasks/${tarea.id}/confirmar-solucion/`,
        { method: "POST" }
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
      title="Confirmar solución"
      onClose={enviando ? () => {} : onClose}
      maxWidth={520}
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
            onClick={() => void confirmar()}
            disabled={enviando}
            style={{
              background: "var(--color-done)",
              color: "var(--color-on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {enviando ? "Confirmando…" : "Confirmar solución"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)" }}>
        ¿Confirmas que la solicitud{" "}
        <strong>{tarea.ticket ?? `#${tarea.id}`}</strong> quedó resuelta
        satisfactoriamente?
      </p>
      {tarea.fecha_limite_confirmacion && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
          Puedes confirmar o reabrir hasta el{" "}
          <strong>{fmt(tarea.fecha_limite_confirmacion)}</strong>.
        </p>
      )}
      {error && (
        <p role="alert" style={{ margin: "10px 0 0", color: "var(--color-danger)", fontSize: 12 }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
