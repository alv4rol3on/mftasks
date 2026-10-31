"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Subtarea } from "@/lib/types";

type Props = {
  subtarea: Subtarea;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
};

export default function ReabrirSubtareaDialog({ subtarea, onClose, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!motivo.trim()) {
      setError("El motivo de reapertura es obligatorio.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(motivo.trim());
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      title="Reabrir subtarea solucionada"
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
              background: "var(--color-waiting)",
              color: "var(--color-on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {enviando ? "Reabriendo…" : "Reabrir subtarea"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)" }}>
        La subtarea <strong>{subtarea.codigo ?? `#${subtarea.id}`}</strong> volverá
        a <strong>En desarrollo</strong> y la solicitud dejará de estar solucionada.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Motivo de reapertura *</span>
        <textarea
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setError(null);
          }}
          rows={4}
          maxLength={2000}
          placeholder="Explica por qué se reabre el trabajo"
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
