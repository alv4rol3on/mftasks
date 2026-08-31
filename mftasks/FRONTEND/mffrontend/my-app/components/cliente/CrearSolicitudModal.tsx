"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import { CampanaInfo, ClienteInfo, EquipoInfo, SubCampanaInfo } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CrearSolicitudModal({ open, onClose, onCreated }: Props) {
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const [campanaId, setCampanaId] = useState<number | "">("");
  const [subcampanaId, setSubcampanaId] = useState<number | "">("");
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [clientes, setClientes] = useState<ClienteInfo[]>([]);
  const [campanas, setCampanas] = useState<CampanaInfo[]>([]);
  const [subcampanas, setSubcampanas] = useState<SubCampanaInfo[]>([]);
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<ClienteInfo[]>("/api/clientes/clientes/")
      .then(setClientes)
      .catch(() => setClientes([]));
    apiFetch<CampanaInfo[]>("/api/campanas/campanas/")
      .then((data) => setCampanas(Array.isArray(data) ? data : (data as any).results ?? []))
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
      .then((data) => setSubcampanas(Array.isArray(data) ? data : (data as any).results ?? []))
      .catch(() => setSubcampanas([]));
  }, [campanaId]);

  if (!open) return null;

  const enviar = async () => {
    if (!asunto.trim() || !descripcion.trim() || clienteId === "" || campanaId === "" || subcampanaId === "" || equipoId === "") {
      setError("Completa asunto, descripción, cliente, campaña, subcampaña y equipo.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await apiFetch("/api/tasks/tasks/", {
        method: "POST",
        body: JSON.stringify({
          asunto: asunto.trim(),
          descripcion: descripcion.trim(),
          cliente: Number(clienteId),
          subcampana: Number(subcampanaId),
          equipo: Number(equipoId),
        }),
      });
      setAsunto("");
      setDescripcion("");
      setClienteId("");
      setCampanaId("");
      setSubcampanaId("");
      setEquipoId("");
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
            <p>Será revisada por el asignador</p>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.iniciarBody}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Asunto
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={styles.inputField} placeholder="Ej. Reporte mensual" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Descripción
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={styles.inputField} rows={4} placeholder="Detalla la solicitud" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Cliente
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField}>
                <option value="">Seleccionar…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Campaña (solo tus permitidas)
              <select value={campanaId} onChange={(e) => setCampanaId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField}>
                <option value="">Seleccionar…</option>
                {campanas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Subcampaña (solo permitidas)
              <select value={subcampanaId} onChange={(e) => setSubcampanaId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField} disabled={!campanaId}>
                <option value="">{campanaId ? "Seleccionar…" : "Elige campaña primero"}</option>
                {subcampanas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Equipo
              <select value={equipoId} onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField}>
                <option value="">Seleccionar…</option>
                {equipos.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </label>
          </div>
          {campanaId && subcampanas.length===0 && <p style={{ fontSize:12, color:"#92400e", marginTop:6 }}>No tienes subcampañas permitidas en esta campaña. Contacta al administrador.</p>}
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
