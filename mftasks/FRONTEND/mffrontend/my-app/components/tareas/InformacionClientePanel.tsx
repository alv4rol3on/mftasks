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
  titulo?: string;
  subtitulo?: string;
  mostrarAutor?: boolean;
  headerAction?: React.ReactNode;
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

export default function InformacionClientePanel({
  tareaId,
  refreshKey,
  titulo = "Archivos adicionales",
  subtitulo = "Notas y archivos adicionales enviados por el solicitante.",
  mostrarAutor = true,
  headerAction,
}: Props) {
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
    fetchInformacionCliente(tareaId)
      .then((data) => {
        if (!cancelado) {
          setEntradas(data);
          setError(null);
        }
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
          <h3 className={styles.sectionTitle}>{titulo}</h3>
          <p className={styles.sectionHint}>{subtitulo}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headerAction}

          <RefreshButton
            onClick={cargar}
            loading={recargando}
            variant="outline"
            title="Recargar archivos adicionales"
          />
        </div>
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
                  {mostrarAutor && (
                    <span className={styles.historyUser}>
                      {entrada.usuario ?? "Cliente"}
                    </span>
                  )}
                  <span className={styles.historyEntity}>
                    {mostrarAutor ? "Cliente" : "Tu información"}
                  </span>
                </div>

                <div className={styles.historyDescription}>
                  {entrada.detalle
                    ?.split(" · Archivos adjuntos:")[0]
                    .trim() || "Sin nota adjunta."}
                </div>

                {entrada.archivos.length > 0 && (
                  <div className={styles.historyFiles}>
                    <div className={styles.historyFilesTitle}>
                      <span>Archivos adjuntos</span>
                      <span className={styles.historyFilesCount}>
                        {entrada.archivos.length}
                      </span>
                    </div>

                    <ul className={styles.historyFileList}>
                      {entrada.archivos.map((archivo) => (
                        <li key={archivo.id} className={styles.historyFile}>
                          <div className={styles.historyFileInfo}>
                            <span className={styles.historyFileIcon} aria-hidden="true">
                              📄
                            </span>

                            <div className={styles.historyFileDetails}>
                              <span className={styles.historyFileName}>
                                {archivo.nombre}
                              </span>

                              <span className={styles.historyFileMeta}>
                                {formatearFecha(archivo.fecha_subida)}
                                {archivo.subido_por ? ` · ${archivo.subido_por}` : ""}
                              </span>
                            </div>
                          </div>

                          {archivo.url && (
                            <a
                              href={`${apiBaseUrl}${archivo.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={archivo.nombre}
                              className={styles.historyDownload}
                            >
                              <span aria-hidden="true">Descargar ↓</span>
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
