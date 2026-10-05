"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

import Modal from "@/components/ui/Modal";

import styles from "./AdminSections.module.css";
import type { RolJerarquico } from "./EditarUsuarioModal";

type TipoUsuario = "COLABORADOR" | "CLIENTE" | "ADMINISTRADOR";

type Props = {
  rolesJerarquicos: RolJerarquico[];
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
};

type FormState = {
  email: string;
  nombres: string;
  apellidos: string;
  dni: string;
  cargo: string;
  descripcion_cargo: string;
  telefono: string;
  password: string;
  tipo_usuario: TipoUsuario;
  rol: string;
};

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "ADMINISTRADOR", label: "Administrador" },
];

const FORM_VACIO: FormState = {
  email: "",
  nombres: "",
  apellidos: "",
  dni: "",
  cargo: "",
  descripcion_cargo: "",
  telefono: "",
  password: "",
  tipo_usuario: "COLABORADOR",
  rol: "",
};

export default function CrearUsuarioModal({
  rolesJerarquicos,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDniChange = (value: string) => {
    setForm((prev) => ({ ...prev, dni: value.replace(/\D/g, "").slice(0, 8) }));
  };

  const crear = async () => {
    if (!form.email.trim() || !form.nombres.trim() || !form.apellidos.trim()) {
      setError("Email, nombres y apellidos son obligatorios.");
      return;
    }

    if (!/^\d{8}$/.test(form.dni)) {
      setError("El DNI debe contener exactamente 8 números.");
      return;
    }

    let roles: string[];
    if (form.tipo_usuario === "CLIENTE") {
      roles = ["Cliente"];
    } else if (form.tipo_usuario === "ADMINISTRADOR") {
      roles = ["Administrador"];
    } else {
      if (!form.rol) {
        setError("Selecciona un rol para el colaborador.");
        return;
      }
      roles = [form.rol];
    }

    setGuardando(true);
    setError(null);

    try {
      await apiFetch("/api/usuarios/usuarios/", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          dni: form.dni,
          cargo: form.cargo.trim(),
          descripcion_cargo: form.descripcion_cargo.trim(),
          telefono: form.telefono.trim(),
          password: form.password || undefined,
          tipo_usuario: form.tipo_usuario,
          roles,
        }),
      });

      await onSaved(
        `Usuario ${form.email.trim()} creado (${form.tipo_usuario.toLowerCase()})`
      );
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
        onClick={crear}
        disabled={guardando}
      >
        {guardando ? "Creando..." : "Crear"}
      </button>
    </>
  );

  return (
    <Modal title="Crear nuevo usuario" onClose={onClose} footer={footer} maxWidth={640}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Nombres *</span>
          <input
            className={styles.input}
            value={form.nombres}
            onChange={(e) => setForm({ ...form, nombres: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>Apellidos *</span>
          <input
            className={styles.input}
            value={form.apellidos}
            onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>DNI *</span>
          <input
            className={styles.input}
            value={form.dni}
            onChange={(e) => handleDniChange(e.target.value)}
            inputMode="numeric"
            maxLength={8}
          />
        </label>

        <label className={styles.field}>
          <span>Email *</span>
          <input
            className={styles.input}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
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

        <label className={styles.field}>
          <span>Descripción del cargo</span>
          <input
            className={styles.input}
            value={form.descripcion_cargo}
            onChange={(e) =>
              setForm({ ...form, descripcion_cargo: e.target.value })
            }
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            className={styles.input}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>Tipo</span>
          <select
            className={styles.select}
            value={form.tipo_usuario}
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
            <span>Rol *</span>
            <select
              className={styles.select}
              value={form.rol}
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
      </div>

      {error && (
        <div className={`${styles.msg} ${styles.msgError}`} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
