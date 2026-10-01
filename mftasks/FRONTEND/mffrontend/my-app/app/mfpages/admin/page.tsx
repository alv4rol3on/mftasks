
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getUsuarioActual } from "@/lib/auth";


import styles from "./Admin.module.css";
import UsuariosSection from "@/components/admin/UsuariosSection";
import CampanasSection from "@/components/admin/CampanasSection";
import PermisosSection from "@/components/admin/PermisosSection";

type Tab = "usuarios" | "roles" | "permisos" | "campanas";

export default function AdminPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("usuarios");
  const [msg, setMsg] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const usuario = getUsuarioActual();

    if (!usuario) {
      router.push("/mfpages/perfil");
      return;
    }

    const esAdministrador = usuario.roles?.some(
      (rol: string) => rol.toLowerCase() === "administrador"
    );

    if (!esAdministrador) {
      router.push("/mfpages/perfil");
      return;
    }

    setEsAdmin(true);
  }, [router]);

  if (esAdmin === null) {
    return null;
  }

  if (!esAdmin) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Administración</h1>
        </div>
      </div>

      {msg && (
        <div className={styles.message}>
          {msg}
        </div>
      )}

      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => setTab("usuarios")}
          className={`${styles.tabBtn} ${tab === "usuarios" ? styles.tabBtnActive : ""
            }`}
        >
          Usuarios
        </button>

        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`${styles.tabBtn} ${tab === "roles" ? styles.tabBtnActive : ""
            }`}
        >
          Roles
        </button>

        <button
          type="button"
          onClick={() => setTab("campanas")}
          className={`${styles.tabBtn} ${tab === "campanas" ? styles.tabBtnActive : ""
            }`}
        >
          Campañas
        </button>

        <button
          type="button"
          onClick={() => setTab("permisos")}
          className={`${styles.tabBtn} ${tab === "permisos" ? styles.tabBtnActive : ""
            }`}
        >
          Permisos
        </button>
      </div>

      <div className={styles.tabContent}>
        {tab === "usuarios" && (
          <UsuariosSection setMsg={setMsg} />
        )}

        {tab === "campanas" && (
          <CampanasSection setMsg={setMsg} />
        )}

        {tab === "permisos" && (
          <PermisosSection setMsg={setMsg} />
        )}
      </div>
    </div>
  );
}
