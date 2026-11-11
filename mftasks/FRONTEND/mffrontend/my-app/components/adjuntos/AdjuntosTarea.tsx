"use client";

import { useState } from "react";
import { apiFetchBlob } from "@/lib/api";
import { ArchivoTarea } from "@/lib/types";

type Props = {
    archivos?: ArchivoTarea[] | null;
    tareaId: number;
    ticket?: string | null;
    titulo?: string;
};

export default function AdjuntosTarea({ archivos, tareaId, ticket, titulo = "Archivos adjuntos" }: Props) {
    const [descargando, setDescargando] = useState(false);
    const [descargandoId, setDescargandoId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!archivos || archivos.length === 0) return null;

    const descargarArchivo = async (archivo: ArchivoTarea) => {
        setError(null);
        setDescargandoId(archivo.id);
        try {
            const blob = await apiFetchBlob(archivo.url);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = archivo.nombre || `archivo-${archivo.id}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setDescargandoId(null);
        }
    };

    const descargarZip = async () => {
        setDescargando(true);
        setError(null);
        try {
            const blob = await apiFetchBlob(`/api/tasks/tasks/${tareaId}/archivos-zip/`);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `adjuntos-${ticket ?? tareaId}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setDescargando(false);
        }
    };

    return (
        <div
            style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                background: "var(--color-surface)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>{titulo}</h4>
                <button
                    type="button"
                    onClick={descargarZip}
                    disabled={descargando}
                    style={{
                        background: "var(--color-detail-header)",
                        color: "var(--color-on-accent)",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: 6,
                        cursor: descargando ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                    }}
                >
                    {descargando ? "Generando ZIP…" : "⬇️ Descargar todo (ZIP)"}
                </button>
            </div>

            {archivos.map((archivo) => (
                <div
                    key={archivo.id}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                    }}
                >
                    <span>📎</span>
                    <button
                        type="button"
                        onClick={() => descargarArchivo(archivo)}
                        disabled={descargandoId === archivo.id}
                        style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "var(--color-link, #2563eb)",
                            cursor:
                                descargandoId === archivo.id
                                    ? "wait"
                                    : "pointer",
                            textDecoration: "underline",
                            fontSize: "inherit",
                        }}
                    >
                        📥{" "}
                        {descargandoId === archivo.id
                            ? "Descargando…"
                            : `Descargar ${archivo.nombre}`}
                    </button>
                </div>
            ))}

            {error && <p style={{ color: "var(--color-danger)", fontSize: 12, margin: "6px 0 0" }}>{error}</p>}
        </div>
    );
}
