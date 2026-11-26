"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";

import styles from "./AdminSections.module.css";

type TipoUsuario = "COLABORADOR" | "ADMINISTRADOR";

export type UsuarioEditable = {
  id: number;
  codigo?: string;
  email: string;
  nombres: string;
  apellidos: string;
  dni: string;
  cargo?: string;
  descripcion_cargo?: string;
  telefono?: string;
  is_active: boolean;
  tipo_usuario?: TipoUsuario;
  nivel?: number | null;
  nivel_nombre?: string | null;
  puede_crear_solicitudes?: boolean;
  bloqueo_estado_nivel?: string | null;
};

export type NivelJerarquico = { id: number; nombre: string };

type Props = {
  usuario: UsuarioEditable;
  nivelesJerarquicos: NivelJerarquico[];
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
};

type FormState = {
  nombres: string;
  apellidos: string;
  email: string;
  dni: string;
  cargo: string;
  descripcion_cargo: string;
  telefono: string;
  tipo_usuario: TipoUsuario;
  nivel: string;
  puede_crear_solicitudes: boolean;
  is_active: boolean;
};

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "ADMINISTRADOR", label: "Administrador" },
];

export default function EditarUsuarioModal({
  usuario,
  nivelesJerarquicos,
  onClose,
  onSaved,
}: Props) {
  const esAdmin = usuario.tipo_usuario === "ADMINISTRADOR";

  const tipoInicial: TipoUsuario = esAdmin ? "ADMINISTRADOR" : "COLABORADOR";

  const nivelActual =
    usuario.nivel ??
    nivelesJerarquicos.find(
      (n) => n.nombre.toLowerCase() === (usuario.nivel_nombre ?? "").toLowerCase()
    )?.id ??
    "";

  const bloqueo = usuario.bloqueo_estado_nivel ?? null;

  const [form, setForm] = useState<FormState>({
    nombres: usuario.nombres ?? "",
    apellidos: usuario.apellidos ?? "",
    email: usuario.email ?? "",
    dni: usuario.dni ?? "",
    cargo: usuario.cargo ?? "",
    descripcion_cargo: usuario.descripcion_cargo ?? "",
    telefono: usuario.telefono ?? "",
    tipo_usuario: tipoInicial,
    nivel: nivelActual === "" ? "" : String(nivelActual),
    puede_crear_solicitudes: usuario.puede_crear_solicitudes ?? false,
    is_active: usuario.is_active,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDniChange = (value: string) => {
    setForm((prev) => ({ ...prev, dni: value.replace(/\D/g, "").slice(0, 8) }));
  };

  const guardar = async () => {
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim()) {
      setError("Nombres, apellidos y email son obligatorios.");
      return;
    }

    if (!/^\d{8}$/.test(form.dni)) {
      setError("El DNI debe contener exactamente 8 números.");
      return;
    }

    const payload: Record<string, unknown> = {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      email: form.email.trim(),
      dni: form.dni,
      cargo: form.cargo.trim(),
      descripcion_cargo: form.descripcion_cargo.trim(),
      telefono: form.telefono.trim(),
    };

    // Estado/nivel/tipo solo se envían si no hay bloqueo.
    if (!bloqueo) {
      let nivel: number | undefined;
      if (form.tipo_usuario === "COLABORADOR") {
        const nivelAsignado = form.nivel;
        if (!nivelAsignado) {
          setError(
            "Selecciona un nivel. Si no hay niveles disponibles, créalo en la pestaña Niveles."
          );
          return;
        }
        nivel = Number(nivelAsignado);
      }
      payload.tipo_usuario = form.tipo_usuario;
      payload.nivel = nivel;
      payload.puede_crear_solicitudes =
        form.tipo_usuario === "COLABORADOR"
          ? form.puede_crear_solicitudes
          : false;
      payload.is_active = form.is_active;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch(`/api/usuarios/usuarios/${usuario.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      await onSaved("Usuario actualizado");
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
        {guardando ? "Guardando..." : "Guardar"}
      </button>
    </>
  );

  return (
    <Modal title="Editar usuario" onClose={onClose} footer={footer} maxWidth={640}>
      {usuario.codigo && (
        <div className={styles.modalHint}>
          Código: <strong>{usuario.codigo}</strong>
        </div>
      )}

      {/* DATOS PERSONALES */}
      <div className={styles.sectionDivider}>
        Datos personales
      </div>

      <div className={styles.formGrid}>
        <input
          className={styles.input}
          placeholder="Nombres *"
          value={form.nombres}
          onChange={(e) => setForm({ ...form, nombres: e.target.value })}
        />

        <input
          className={styles.input}
          placeholder="Apellidos *"
          value={form.apellidos}
          onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
        />

        <input
          className={styles.input}
          type="email"
          placeholder="Correo electrónico *"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          className={styles.input}
          placeholder="DNI *"
          value={form.dni}
          onChange={(e) => handleDniChange(e.target.value)}
          inputMode="numeric"
          maxLength={8}
        />

        <input
          className={styles.input}
          placeholder="Cargo"
          value={form.cargo}
          onChange={(e) => setForm({ ...form, cargo: e.target.value })}
        />

        <input
          className={styles.input}
          placeholder="Teléfono"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
      </div>

      {/*<label className={styles.field} style={{ marginTop: 12 }}>
        <span>Descripción del cargo</span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={form.descripcion_cargo}
          onChange={(e) => setForm({ ...form, descripcion_cargo: e.target.value })}
        />
      </label>*/}

      {/* CONFIGURACIÓN DEL USUARIO */}
      <div className={styles.sectionDivider}>
        Configuración del usuario
      </div>

      {bloqueo && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginBottom: 12 }}>
          {bloqueo}
        </div>
      )}

      <div className={styles.formGrid}>

        <select
          className={styles.select}
          value={form.tipo_usuario}
          disabled={Boolean(bloqueo)}
          title={bloqueo ?? undefined}
          onChange={(e) =>
            setForm({
              ...form,
              tipo_usuario: e.target.value as TipoUsuario,
              nivel: "",
              puede_crear_solicitudes: false,
            })
          }
        >
          {TIPOS_USUARIO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {form.tipo_usuario === "COLABORADOR" && (
          <select
            className={styles.select}
            value={form.nivel}
            disabled={Boolean(bloqueo)}
            title={bloqueo ?? undefined}
            onChange={(e) => setForm({ ...form, nivel: e.target.value })}
          >
            <option value="">Selecciona un nivel *</option>

            {nivelesJerarquicos.map((nivel) => (
              <option key={nivel.id} value={nivel.id}>
                {nivel.nombre}
              </option>
            ))}
          </select>
        )}

        {form.tipo_usuario === "COLABORADOR" && (
          <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.puede_crear_solicitudes}
              disabled={Boolean(bloqueo)}
              onChange={(e) =>
                setForm({ ...form, puede_crear_solicitudes: e.target.checked })
              }
              style={{ width: 16, height: 16 }}
            />
            <span>Puede crear solicitudes (Mis solicitudes)</span>
          </label>
        )}

        <div className={styles.field}>
          <span>Estado del usuario</span>

          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36 }}>
            <Switch
              checked={form.is_active}
              disabled={Boolean(bloqueo)}
              onChange={(v) => setForm({ ...form, is_active: v })}
              label={form.is_active ? "Desactivar usuario" : "Activar usuario"}
              title={
                bloqueo
                  ? bloqueo
                  : form.is_active
                    ? "Desactivar"
                    : "Activar"
              }
            />

            <span style={{ fontSize: 12, color: "var(--color-text)" }}>
              {form.is_active ? "Habilitado" : "Inhabilitado"}
            </span>
          </div>
        </div>

      </div>

      {error && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
