"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";

import styles from "./AdminSections.module.css";

type TipoUsuario = "COLABORADOR" | "CLIENTE" | "ADMINISTRADOR";

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
  roles?: string[];
  bloqueo_estado_rol?: string | null;
};

export type RolJerarquico = { id: number; nombre: string };

type Props = {
  usuario: UsuarioEditable;
  rolesJerarquicos: RolJerarquico[];
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
  rol: string;
  is_active: boolean;
};

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "ADMINISTRADOR", label: "Administrador" },
];

export default function EditarUsuarioModal({
  usuario,
  rolesJerarquicos,
  onClose,
  onSaved,
}: Props) {
  const esAdmin =
    usuario.tipo_usuario === "ADMINISTRADOR" ||
    (usuario.roles ?? []).some((r) => r.toLowerCase() === "administrador");

  const tipoInicial: TipoUsuario =
    usuario.tipo_usuario ?? (esAdmin ? "ADMINISTRADOR" : "COLABORADOR");

  const rolActual = (usuario.roles ?? [])[0] ?? "";
  const rolEnLista = rolesJerarquicos.some(
    (r) => r.nombre.toLowerCase() === rolActual.toLowerCase()
  );

  const bloqueo = usuario.bloqueo_estado_rol ?? null;

  const [form, setForm] = useState<FormState>({
    nombres: usuario.nombres ?? "",
    apellidos: usuario.apellidos ?? "",
    email: usuario.email ?? "",
    dni: usuario.dni ?? "",
    cargo: usuario.cargo ?? "",
    descripcion_cargo: usuario.descripcion_cargo ?? "",
    telefono: usuario.telefono ?? "",
    tipo_usuario: tipoInicial,
    rol: rolEnLista ? rolActual : rolesJerarquicos[0]?.nombre ?? "",
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

    // Estado/rol/tipo solo se envían si no hay bloqueo.
    if (!bloqueo) {
      let roles: string[];
      if (form.tipo_usuario === "CLIENTE") {
        roles = ["Cliente"];
      } else if (form.tipo_usuario === "ADMINISTRADOR") {
        roles = ["Administrador"];
      } else {
        const rolAsignado = form.rol || rolesJerarquicos[0]?.nombre;
        if (!rolAsignado) {
          setError(
            "No hay roles jerárquicos disponibles. Cree uno en la pestaña Roles."
          );
          return;
        }
        roles = [rolAsignado];
      }
      payload.tipo_usuario = form.tipo_usuario;
      payload.roles = roles;
      payload.is_active = form.is_active;
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch(`/api/usuarios/usuarios/${usuario.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      await onSaved(`Usuario ${form.email.trim()} actualizado`);
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

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Nombres</span>
          <input
            className={styles.input}
            value={form.nombres}
            onChange={(e) => setForm({ ...form, nombres: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>Apellidos</span>
          <input
            className={styles.input}
            value={form.apellidos}
            onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>Email</span>
          <input
            className={styles.input}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>DNI</span>
          <input
            className={styles.input}
            value={form.dni}
            onChange={(e) => handleDniChange(e.target.value)}
            inputMode="numeric"
            maxLength={8}
          />
        </label>

        <label className={styles.field}>
          <span>Cargo</span>
          <input
            className={styles.input}
            value={form.cargo}
            onChange={(e) => setForm({ ...form, cargo: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>Teléfono</span>
          <input
            className={styles.input}
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
        </label>
      </div>

      <label className={styles.field} style={{ marginTop: 12 }}>
        <span>Descripción del cargo</span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={form.descripcion_cargo}
          onChange={(e) => setForm({ ...form, descripcion_cargo: e.target.value })}
        />
      </label>

      <div className={styles.sectionDivider}>Acceso y rol</div>

      {bloqueo && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginBottom: 12 }}>
          {bloqueo}
        </div>
      )}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Tipo</span>
          <select
            className={styles.select}
            value={form.tipo_usuario}
            disabled={Boolean(bloqueo)}
            title={bloqueo ?? undefined}
            onChange={(e) =>
              setForm({ ...form, tipo_usuario: e.target.value as TipoUsuario })
            }
          >
            {TIPOS_USUARIO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {form.tipo_usuario === "COLABORADOR" && (
          <label className={styles.field}>
            <span>Rol</span>
            <select
              className={styles.select}
              value={form.rol}
              disabled={Boolean(bloqueo)}
              title={bloqueo ?? undefined}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
            >
              <option value="">Selecciona un rol...</option>
              {rolesJerarquicos.map((r) => (
                <option key={r.id} value={r.nombre}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.field}>
          <span>Activo</span>
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
            <span style={{ fontSize: 12, color: "#374151" }}>
              {form.is_active ? "Habilitado" : "Inhabilitado"}
            </span>
          </div>
        </label>
      </div>

      {error && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
