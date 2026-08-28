"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "../tareas/TaskModalDesarrollo.module.css";
import { ClienteInfo, EquipoInfo } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CrearSolicitudModal({ open, onClose, onCreated }: Props) {
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const [equipoId, setEquipoId] = useState<number | "">("");
  const [clientes, setClientes] = useState<ClienteInfo[]>([]);
  const [equipos, setEquipos] = useState<EquipoInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<ClienteInfo[]>("/api/clientes/clientes/")
      .then(setClientes)
      .catch(() => setClientes([]));
    apiFetch<EquipoInfo[]>("/api/usuarios/equipos/")
      .then((data) => setEquipos(Array.isArray(data) ? data : (data as any).results ?? []))
      .catch(() => setEquipos([]));
  }, [open]);

  if (!open) return null;

  const enviar = async () => {
    if (!asunto.trim() || !descripcion.trim() || clienteId === "" || equipoId === "") {
      setError("Completa asunto, descripción, cliente y equipo.");
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
          equipo: Number(equipoId),
        }),
      });
      setAsunto("");
      setDescripcion("");
      setClienteId("");
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
              Campaña
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : "")} className={styles.inputField}>
                <option value="">Seleccionar…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
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
