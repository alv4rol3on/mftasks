"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/authConfig";
import {
  fetchInformacionCliente,
  type EntradaInformacionCliente,
} from "@/lib/services/tareasService";
import RefreshButton from "@/components/ui/RefreshButton";
import styles from "./TareaDetalle.module.css";

type Props = {
  tareaId: number;
  refreshKey?: string | number;
};

const formatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatearFecha = (fecha: string | null | undefined) => {
  if (!fecha) return "-";
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return "-";
  return formatter.format(date);
};

export default function InformacionClientePanel({ tareaId, refreshKey }: Props) {
  const [entradas, setEntradas] = useState<EntradaInformacionCliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = async () => {
    setRecargando(true);
    setError(null);
    try {
      const data = await fetchInformacionCliente(tareaId);
      setEntradas(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecargando(false);
    }
  };

  useEffect(() => {
    let cancelado = false;
    setError(null);
    fetchInformacionCliente(tareaId)
      .then((data) => {
        if (!cancelado) setEntradas(data);
      })
      .catch((e) => {
        if (!cancelado) setError((e as Error).message);
      });
    return () => {
      cancelado = true;
    };
  }, [tareaId, refreshKey]);

  return (
    <div>
      <div className={styles.historyHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Información del cliente</h3>
          <p className={styles.sectionHint}>
            Notas y archivos adicionales enviados por el solicitante.
          </p>
        </div>
        <RefreshButton
          onClick={cargar}
          loading={recargando}
          variant="outline"
          title="Recargar información del cliente"
        />
      </div>

      {error && <p className={styles.errorNotice}>{error}</p>}

      {!entradas && !error && (
        <p className={styles.sinSubtareas}>Cargando información…</p>
      )}

      {entradas && entradas.length === 0 && (
        <div className={styles.historyEmpty}>
          <strong>Sin información adicional</strong>
          <p>
            Cuando el cliente agregue notas o archivos aparecerán en esta
            sección.
          </p>
        </div>
      )}

      {entradas && entradas.length > 0 && (
        <ol className={styles.historyList} aria-label="Información adicional del cliente">
          {entradas.map((entrada) => (
            <li key={entrada.id} className={styles.historyItem}>
              <span
                className={`${styles.historyDot} ${styles.historyDotTask}`}
                aria-hidden="true"
              />
              <div className={styles.historyBody}>
                <div className={styles.historyTop}>
                  <span className={styles.historyEvent}>Información adicional</span>
                  <time className={styles.historyDate} dateTime={entrada.fecha ?? undefined}>
                    {formatearFecha(entrada.fecha)}
                  </time>
                </div>

                <div className={styles.historyMeta}>
                  <span className={styles.historyUser}>
                    {entrada.usuario ?? "Cliente"}
                  </span>
                  <span className={styles.historyEntity}>Cliente</span>
                </div>

                <div style={{ marginTop: 6, color: "var(--color-text)", fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {entrada.detalle || "Sin nota adjunta."}
                </div>

                {entrada.archivos.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--color-text-secondary)", marginBottom: 6 }}>
                      Archivos ({entrada.archivos.length})
                    </div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                      {entrada.archivos.map((archivo) => (
                        <li
                          key={archivo.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            border: "1px solid var(--color-border)",
                            borderRadius: 7,
                            background: "var(--color-background)",
                            padding: "7px 10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: "anywhere" }}>
                              {archivo.nombre}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--color-text-secondary)" }}>
                              {formatearFecha(archivo.fecha_subida)}
                              {archivo.subido_por ? ` · ${archivo.subido_por}` : ""}
                            </div>
                          </div>
                          {archivo.url && (
                            <a
                              href={`${apiBaseUrl}${archivo.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={archivo.nombre}
                              style={{
                                flexShrink: 0,
                                border: "1px solid var(--color-border)",
                                borderRadius: 6,
                                background: "var(--color-surface)",
                                color: "var(--color-text)",
                                padding: "5px 10px",
                                fontSize: 11.5,
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              Descargar
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
