"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

import Modal from "@/components/ui/Modal";

import styles from "./AdminSections.module.css";
import type { NivelJerarquico } from "./EditarUsuarioModal";

type TipoUsuario = "" | "COLABORADOR" | "ADMINISTRADOR";

type Props = {
  nivelesJerarquicos: NivelJerarquico[];
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
  nivel: string;
  puede_crear_solicitudes: boolean;
};

const TIPOS_USUARIO: { value: TipoUsuario; label: string }[] = [
  { value: "COLABORADOR", label: "Colaborador" },
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
  tipo_usuario: "",
  nivel: "",
  puede_crear_solicitudes: false,
};

export default function CrearUsuarioModal({
  nivelesJerarquicos,
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

    if (!form.tipo_usuario) {
      setError("Selecciona un tipo de usuario.");
      return;
    }

    let nivel: number | undefined;
    if (form.tipo_usuario === "COLABORADOR") {
      if (!form.nivel) {
        setError("Selecciona un nivel para el colaborador.");
        return;
      }
      nivel = Number(form.nivel);
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
          nivel,
          puede_crear_solicitudes:
            form.tipo_usuario === "COLABORADOR"
              ? form.puede_crear_solicitudes
              : false,
        }),
      });

      await onSaved("Usuario creado");
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

        {/* DATOS PERSONALES */}
        <div className={styles.sectionDivider}>
          Datos personales
        </div>

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
          placeholder="DNI *"
          value={form.dni}
          onChange={(e) => handleDniChange(e.target.value)}
          inputMode="numeric"
          maxLength={8}
        />

        <input
          className={styles.input}
          placeholder="Telefono "
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />



        <input
          className={styles.input}
          placeholder="Cargo"
          value={form.cargo}
          onChange={(e) => setForm({ ...form, cargo: e.target.value })}
        />

        {/* CREDENCIALES */}
        <div className={styles.sectionDivider}>
          Credenciales de acceso
        </div>


        <input
          className={styles.input}
          type="email"
          placeholder="Correo electrònico *"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />



        {/* CONFIGURACIÓN */}
        <div className={styles.sectionDivider}>
          Configuración del usuario
        </div>

        <label className={styles.field}>
          <select
            className={styles.select}
            value={form.tipo_usuario}
            onChange={(e) =>
              setForm({
                ...form,
                tipo_usuario: e.target.value as TipoUsuario,
                nivel: "",
                puede_crear_solicitudes: false,
              })
            }
          >
            <option value="" disabled>
              Selecciona el tipo de usuario *
            </option>

            {TIPOS_USUARIO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {form.tipo_usuario === "COLABORADOR" && (
          <>
            <label className={styles.field}>
              <select
                className={styles.select}
                value={form.nivel}
                onChange={(e) => setForm({ ...form, nivel: e.target.value })}
              >
                <option value="">Selecciona un nivel *</option>

                {nivelesJerarquicos.map((nivel) => (
                  <option key={nivel.id} value={nivel.id}>
                    {nivel.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={form.puede_crear_solicitudes}
                onChange={(e) =>
                  setForm({ ...form, puede_crear_solicitudes: e.target.checked })
                }
                style={{ width: 16, height: 16 }}
              />
              <span>Puede crear solicitudes (Mis solicitudes)</span>
            </label>
          </>
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
