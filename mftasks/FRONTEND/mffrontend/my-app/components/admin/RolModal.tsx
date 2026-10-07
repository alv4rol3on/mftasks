"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

import Modal from "@/components/ui/Modal";
import SearchableSelect, {
  SearchableOption,
} from "@/components/ui/SearchableSelect";
import Switch from "@/components/ui/Switch";

import type { RolInfo } from "@/lib/types";

import styles from "./AdminSections.module.css";

type Props = {
  rol: RolInfo | null;
  opcionesSuperior: SearchableOption[];
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
};

type FormRol = {
  nombre: string;
  descripcion: string;
  superior: string;
  puede_liderar: boolean;
  auto_aprobar: boolean;
  activo: boolean;
  color: string;
};

const HEX_RE = /^#(?:[0-9a-fA-F]{6})$/;

export default function RolModal({
  rol,
  opcionesSuperior,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormRol>({
    nombre: rol?.nombre ?? "",
    descripcion: rol?.descripcion ?? "",
    superior: rol?.superior != null ? String(rol.superior) : "",
    puede_liderar: rol?.puede_liderar ?? false,
    auto_aprobar: rol?.auto_aprobar ?? false,
    activo: rol?.activo ?? true,
    color: rol?.color ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esEdicion = rol != null;

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError("El nombre del rol es obligatorio.");
      return;
    }

    const color = form.color.trim();
    if (color && !HEX_RE.test(color)) {
      setError("El color debe tener formato #RRGGBB.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      superior: form.superior ? Number(form.superior) : null,
      puede_liderar: form.puede_liderar,
      auto_aprobar: form.auto_aprobar,
      activo: form.activo,
      color,
    };

    setGuardando(true);
    setError(null);

    try {
      if (esEdicion && rol) {
        await apiFetch(`/api/usuarios/roles/${rol.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await onSaved(`Rol "${payload.nombre}" actualizado.`);
      } else {
        await apiFetch("/api/usuarios/roles/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await onSaved(`Rol "${payload.nombre}" creado.`);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        className={styles.btnSecondary}
        onClick={onClose}
        disabled={guardando}
      >
        Cancelar
      </button>
      <button
        type="button"
        className={styles.btnPrimary}
        onClick={guardar}
        disabled={guardando}
      >
        {guardando
          ? "Guardando..."
          : esEdicion
            ? "Guardar cambios"
            : "Crear rol"}
      </button>
    </>
  );

  return (
    <Modal
      title={esEdicion ? `Editar rol: ${rol?.nombre ?? ""}` : "Crear nuevo rol"}
      onClose={onClose}
      footer={footer}
    >
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Nombre del rol *</span>
          <input
            className={styles.input}
            placeholder="p. ej. Coordinador"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>Descripción</span>
          <input
            className={styles.input}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </label>
      </div>

      <label className={styles.field} style={{ marginTop: 12 }}>
        <span>Superior directo (aprobador)</span>
        <SearchableSelect
          value={form.superior}
          onChange={(v) => setForm({ ...form, superior: v })}
          options={opcionesSuperior}
          placeholder="— Sin superior (raíz) —"
          emptyText="Sin roles disponibles"
        />
      </label>

      <div className={styles.formGrid} style={{ marginTop: 12 }}>
        <label className={styles.field}>
          <span>Puede liderar equipos</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <Switch
              checked={form.puede_liderar}
              onChange={(v) => setForm({ ...form, puede_liderar: v })}
              label="Puede liderar equipos"
              title="Permite asignar usuarios con este rol como líderes de equipo"
            />
            <span style={{ fontSize: 12, color: "#374151" }}>
              {form.puede_liderar ? "Sí" : "No"}
            </span>
          </div>
        </label>

        <label className={styles.field}>
          <span>Autoaprobación</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <Switch
              checked={form.auto_aprobar}
              onChange={(v) => setForm({ ...form, auto_aprobar: v })}
              label="Autoaprobación"
              title="Las solicitudes de equipos de este rol saltan la fase de aprobadores y pasan directo a revisión del líder"
            />
            <span style={{ fontSize: 12, color: "#374151" }}>
              {form.auto_aprobar ? "Sí" : "No"}
            </span>
          </div>
        </label>
      </div>

      <label className={styles.field} style={{ marginTop: 12 }}>
        <span>Color de la barra del equipo</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="color"
            aria-label="Selector de color"
            value={HEX_RE.test(form.color) ? form.color : "#252525"}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            style={{ width: 44, height: 36, padding: 2, border: "1px solid #d1d5db", borderRadius: 8, background: "white", cursor: "pointer" }}
          />
          <input
            className={styles.input}
            placeholder="#RRGGBB (vacío = neutro)"
            value={form.color}
            maxLength={7}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            style={{ width: 160, fontFamily: "monospace" }}
          />
          <span
            aria-label="Vista previa del color"
            title="Vista previa"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: HEX_RE.test(form.color) ? form.color : "#252525",
            }}
          />
          {form.color && (
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => setForm({ ...form, color: "" })}
            >
              Quitar color
            </button>
          )}
        </div>
      </label>

      {error && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
