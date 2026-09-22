"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import stylesSuccess from "./SolicitudGenerada.module.css";
import { CampanaInfo, EquipoInfo, SubCampanaInfo, Task } from "@/lib/types";

const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const EXTENSIONES_PERMITIDAS = ["pdf", "doc", "docx", "xls", "xlsx", "txt", "png", "jpg", "jpeg", "zip"];
const ACCEPT_ARCHIVOS = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.zip";

const extensionDe = (nombre: string) => {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : "";
};

const formatearBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CrearSolicitudModal({ open, onClose, onCreated }: Props) {
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [campanaId, setCampanaId] = useState<number | "">("");
  const [subcampanaId, setSubcampanaId] = useState<number | "">("");
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [campanas, setCampanas] = useState<CampanaInfo[]>([]);
  const [subcampanas, setSubcampanas] = useState<SubCampanaInfo[]>([]);
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState<{ ticket: string | null; asunto: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<CampanaInfo[]>("/api/campanas/campanas/")
      .then((data) => {
        const arr: CampanaInfo[] = Array.isArray(data) ? data : (data as any).results ?? [];
        setCampanas(arr.filter((c) => c.activo));
      })
      .catch(() => setCampanas([]));
    apiFetch<EquipoInfo[]>("/api/usuarios/equipos/")
      .then((data) => setEquipos(Array.isArray(data) ? data : (data as any).results ?? []))
      .catch(() => setEquipos([]));
  }, [open]);

  useEffect(() => {
    if (!campanaId) {
      setSubcampanas([]);
      setSubcampanaId("");
      return;
    }
    apiFetch<SubCampanaInfo[]>(`/api/campanas/subcampanas/?campana_id=${campanaId}`)
      .then((data) => {
        const arr: SubCampanaInfo[] = Array.isArray(data) ? data : (data as any).results ?? [];
        setSubcampanas(arr.filter((s) => s.activo));
      })
      .catch(() => setSubcampanas([]));
  }, [campanaId]);

  if (!open) return null;

  if (creada) {
    return (
      <div className={stylesSuccess.overlay}>
        <div className={stylesSuccess.card}>
          <div className={stylesSuccess.circle}>
            <svg className={stylesSuccess.check} viewBox="0 0 52 52" aria-hidden="true">
              <path d="M14 27 L23 36 L38 18" />
            </svg>
          </div>
          <h2 className={stylesSuccess.title}>¡Solicitud generada exitosamente!</h2>
          {creada.ticket && (
            <p className={stylesSuccess.ticket}>N.º {creada.ticket}</p>
          )}
          <p className={stylesSuccess.asunto}>{creada.asunto}</p>
          <button
            type="button"
            className={stylesSuccess.button}
            onClick={() => {
              setCreada(null);
              onClose();
            }}
          >
            Aceptar
          </button>
        </div>
      </div>
    );
  }


  const totalBytes = archivos.reduce((acc, f) => acc + f.size, 0);

  const agregarArchivos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const resultado = [...archivos];
    const rechazados: string[] = [];
    let total = totalBytes;
    for (const f of Array.from(files)) {
      if (!EXTENSIONES_PERMITIDAS.includes(extensionDe(f.name))) {
        rechazados.push(`${f.name} (formato no permitido)`);
        continue;
      }
      const duplicado = resultado.some(
        (x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified
      );
      if (duplicado) continue;
      if (total + f.size > MAX_TOTAL_BYTES) {
        rechazados.push(`${f.name} (supera el límite de 10 MB en total)`);
        continue;
      }
      resultado.push(f);
      total += f.size;
    }
    setArchivos(resultado);
    setError(rechazados.length > 0 ? `No se agregaron: ${rechazados.join(", ")}.` : null);
  };

  const quitarArchivo = (index: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const enviar = async () => {
    if (
      !asunto.trim() ||
      !descripcion.trim() ||
      campanaId === "" ||
      subcampanaId === "" ||
      equipoId === ""
    ) {
      setError("Completa asunto, descripción, campaña, subcampaña y equipo.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const formData = new FormData();

      formData.append("asunto", asunto.trim());
      formData.append("descripcion", descripcion.trim());
      formData.append("subcampana", String(subcampanaId));
      formData.append("equipo", String(equipoId));

      archivos.forEach((f) => formData.append("archivos", f, f.name));

      const asuntoEnviado = asunto.trim();

      const res = await apiFetch<Task>("/api/tasks/tasks/", {
        method: "POST",
        body: formData,
      });

      setAsunto("");
      setDescripcion("");
      setCampanaId("");
      setSubcampanaId("");
      setEquipoId("");
      setArchivos([]);

      onCreated();
      setCreada({ ticket: res?.ticket ?? null, asunto: asuntoEnviado });

    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };



  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>

          <div>
            <h2>Nueva solicitud</h2>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.iniciarBody}>

          <div className={styles.crearGrid}>
            <select value={campanaId} onChange={(e) => setCampanaId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField}>
              <option value="">Seleccionar Campaña</option>
              {campanas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>

            <select value={subcampanaId} onChange={(e) => setSubcampanaId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField} disabled={!campanaId}>
              <option value="">{campanaId ? "Seleccionar Subcampaña" : "Elige campaña primero"}</option>
              {subcampanas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>
              ))}
            </select>


            <select value={equipoId} onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField}>
              <option value="">Selecciona Equipo</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>

            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={styles.inputField} placeholder="Escribir asunto" />

            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={styles.inputField} rows={4} placeholder="Detalla la solicitud" />

            <div className={styles.fileField}>
              <label htmlFor="archivo">Archivos adjuntos (opcional) — máx. 10 MB en total</label>

              <input
                id="archivo"
                type="file"
                multiple
                accept={ACCEPT_ARCHIVOS}
                onChange={(e) => {
                  agregarArchivos(e.target.files);
                  e.currentTarget.value = "";
                }}
              />

              {archivos.length > 0 && (
                <>
                  <ul className={styles.fileList}>
                    {archivos.map((f, i) => (
                      <li key={`${f.name}-${f.size}-${f.lastModified}-${i}`} className={styles.fileItem}>
                        <span className={styles.fileName}>📎 {f.name}</span>
                        <span className={styles.fileSize}>{formatearBytes(f.size)}</span>
                        <button
                          type="button"
                          className={styles.fileRemove}
                          onClick={() => quitarArchivo(i)}
                          title="Quitar archivo"
                          aria-label={`Quitar ${f.name}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.fileHint}>{formatearBytes(totalBytes)} de 10 MB</div>
                </>
              )}
            </div>


          </div>


          {campanaId && subcampanas.length === 0 && <p style={{ fontSize: 12, color: "#92400e", marginTop: 6 }}>La campaña/subcampañas que intenta elegir esta temporalmente deshabilitada o no cuenta con los permisos para crear una solicitud. Contacta al administrador.</p>}
          {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btn} ${styles.btnYes}`} onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : "Crear solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
