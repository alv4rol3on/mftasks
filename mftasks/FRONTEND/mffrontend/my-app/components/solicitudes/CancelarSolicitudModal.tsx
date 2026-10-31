"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { Task } from "@/lib/types";

type Props = {
  tarea: Task;
  onClose: () => void;
  onCancelled: () => void;
};

export default function CancelarSolicitudModal({
  tarea,
  onClose,
  onCancelled,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    const limpio = motivo.trim();
    if (!limpio) {
      setError("El motivo de cancelación es obligatorio.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await apiFetch(`/api/tasks/tasks/${tarea.id}/`, {
        method: "DELETE",
        body: JSON.stringify({ motivo_cancelacion: limpio }),
      });
      onCancelled();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      title="Cancelar solicitud"
      onClose={onClose}
      maxWidth={520}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            style={{
              background: "var(--color-background)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || !motivo.trim()}
            style={{
              background: "var(--color-danger)",
              color: "var(--color-on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando || !motivo.trim() ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
              opacity: enviando || !motivo.trim() ? 0.6 : 1,
            }}
          >
            {enviando ? "Cancelando…" : "Cancelar solicitud"}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>
          La solicitud <strong>{tarea.ticket ?? `#${tarea.id}`}</strong> no se
          eliminará del sistema. Quedará inhabilitada con estado{" "}
          <strong>Cancelado</strong> y el motivo quedará registrado en el
          historial.
        </p>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Motivo de cancelación *
          </span>
          <textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError(null);
            }}
            rows={4}
            maxLength={500}
            placeholder="Indica por qué se cancela esta solicitud"
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
          />
        </label>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--color-danger)" }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
