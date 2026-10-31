"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Task } from "@/lib/types";
import {
  ACCEPT_ARCHIVOS,
  extensionDe,
  formatearBytes,
  validarArchivos,
} from "@/lib/archivos";
import Modal from "@/components/ui/Modal";

type Props = {
  tarea: Task;
  onClose: () => void;
  onSaved: (tarea: Task) => void;
};

export default function AgregarInformacionModal({
  tarea,
  onClose,
  onSaved,
}: Props) {
  const [detalle, setDetalle] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const agregarArchivos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { validos, errores } = validarArchivos(Array.from(files), archivos);
    setArchivos((prev) => [...prev, ...validos]);
    setError(errores.length ? `No se agregaron: ${errores.join(", ")}.` : null);
  };

  const enviar = async () => {
    if (!detalle.trim() && archivos.length === 0) {
      setError("Agrega una nota o al menos un archivo.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const formData = new FormData();
      if (detalle.trim()) formData.append("detalle", detalle.trim());
      archivos.forEach((archivo) =>
        formData.append("archivos", archivo, archivo.name)
      );

      const actualizada = await apiFetch<Task>(
        `/api/tasks/tasks/${tarea.id}/informacion-adicional/`,
        { method: "POST", body: formData }
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
      title="Agregar información"
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
            onClick={() => void enviar()}
            disabled={enviando}
            style={{
              background: "var(--color-brand)",
              color: "var(--color-on-accent)",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {enviando ? "Guardando…" : "Agregar"}
          </button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-secondary)" }}>
        La nota y los archivos quedarán registrados en el historial de la
        solicitud <strong>{tarea.ticket ?? `#${tarea.id}`}</strong>.
      </p>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Información adicional
        </span>
        <textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Agrega contexto, aclaraciones o información faltante"
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

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          style={{
            background: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px dashed var(--color-border)",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: enviando ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          + Agregar archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ARCHIVOS}
          style={{ display: "none" }}
          onChange={(e) => {
            agregarArchivos(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
          Máx. 10 MB en total
        </span>

        {archivos.length > 0 && (
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {archivos.map((archivo, index) => (
              <li
                key={`${archivo.name}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {archivo.name}{" "}
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    ({extensionDe(archivo.name).toUpperCase()} · {formatearBytes(archivo.size)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setArchivos((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={enviando}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-danger)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" style={{ margin: "10px 0 0", color: "var(--color-danger)", fontSize: 12 }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
