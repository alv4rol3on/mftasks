
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getUsuarioActual } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";


import styles from "./Admin.module.css";
import UsuariosSection from "@/components/admin/UsuariosSection";
import CampanasSection from "@/components/admin/CampanasSection";
import PermisosSection from "@/components/admin/PermisosSection";
import AjustesSection from "@/components/admin/AjustesSection";
import NivelesSection from "@/components/admin/NivelesSection";

type Tab = "usuarios" | "niveles" | "permisos" | "campanas" | "ajustes";

const TAB_TITULOS: Record<Tab, string> = {
  usuarios: "Usuarios",
  niveles: "Niveles",
  permisos: "Permisos",
  campanas: "Campañas",
  ajustes: "Ajustes",
};

export default function AdminPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("usuarios");
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);

  const setMsg = useCallback(
    (message: string | null) => {
      if (!message) return;

      const texto = message.toLowerCase();
      const esError =
        texto.startsWith("error") ||
        texto.includes("no se pudo") ||
        texto.includes("no se puede") ||
        texto.includes("no puedes") ||
        texto.includes("inválid") ||
        texto.includes("invalid") ||
        texto.includes("obligatori") ||
        texto.includes(" debe ") ||
        texto.startsWith("debes ");
      const esInfo =
        texto.startsWith("hay ") || texto.startsWith("no hay");

      showToast(message, esError ? "error" : esInfo ? "info" : "success");
    },
    [showToast]
  );

  useEffect(() => {
    document.title = `${TAB_TITULOS[tab]} · Administración general · MF Tasks`;
  }, [tab]);

  useEffect(() => {
    const usuario = getUsuarioActual();

    if (!usuario) {
      router.push("/perfil");
      return;
    }

    const esAdministrador = usuario.tipo_usuario === "ADMINISTRADOR";

    if (!esAdministrador) {
      router.push("/perfil");
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
          <h1 className={styles.title}>Administración general </h1>
        </div>
      </div>

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
          onClick={() => setTab("niveles")}
          className={`${styles.tabBtn} ${tab === "niveles" ? styles.tabBtnActive : ""
            }`}
        >
          Niveles
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

        <button
          type="button"
          onClick={() => setTab("ajustes")}
          className={`${styles.tabBtn} ${tab === "ajustes" ? styles.tabBtnActive : ""
            }`}
        >
          Ajustes
        </button>
      </div>

      <div className={styles.tabContent}>
        {tab === "usuarios" && (
          <UsuariosSection setMsg={setMsg} />
        )}

        {tab === "niveles" && (
          <NivelesSection setMsg={setMsg} />
        )}

        {tab === "campanas" && (
          <CampanasSection setMsg={setMsg} />
        )}

        {tab === "permisos" && (
          <PermisosSection setMsg={setMsg} />
        )}

        {tab === "ajustes" && (
          <AjustesSection setMsg={setMsg} />
        )}
      </div>
    </div>
  );
}
