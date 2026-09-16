"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import { CampanaInfo, EquipoInfo, SubCampanaInfo } from "@/lib/types";

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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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

      if (archivo) {
        formData.append("archivo", archivo);
      }

      await apiFetch("/api/tasks/tasks/", {
        method: "POST",
        body: formData,
      });

      setAsunto("");
      setDescripcion("");
      setCampanaId("");
      setSubcampanaId("");
      setEquipoId("");
      setArchivo(null);

      onCreated();
      onClose();

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
              <label htmlFor="archivo">Archivo adjunto (opcional)</label>

              <input
                id="archivo"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;

                  if (file && file.size > 10 * 1024 * 1024) {
                    setArchivo(null);
                    setError("El archivo no puede superar los 10 MB.");
                    e.currentTarget.value = "";
                    return;
                  }

                  setError(null);
                  setArchivo(file);
                }}
              />

              {archivo && (
                <div className={styles.fileInfo}>
                  📎 {archivo.name}
                </div>
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
