"use client";

import { useState } from "react";
import { apiFetchBlob } from "@/lib/api";
import { apiBaseUrl } from "@/lib/authConfig";
import { ArchivoTarea } from "@/lib/types";

type Props = {
    archivos?: ArchivoTarea[] | null;
    tareaId: number;
    ticket?: string | null;
    titulo?: string;
};

export default function AdjuntosTarea({ archivos, tareaId, ticket, titulo = "Archivos adjuntos" }: Props) {
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!archivos || archivos.length === 0) return null;

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
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#fafafa",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>{titulo}</h4>
                <button
                    type="button"
                    onClick={descargarZip}
                    disabled={descargando}
                    style={{
                        background: "#3128bb",
                        color: "white",
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
                    <a
                        href={`${apiBaseUrl}${archivo.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        📥 Descargar {archivo.nombre}
                    </a>
                </div>
            ))}

            {error && <p style={{ color: "#991b1b", fontSize: 12, margin: "6px 0 0" }}>{error}</p>}
        </div>
    );
}
