"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import Sidebar from "./Sidebar";
import "../components/DashboardLayout.css";
import {
    cerrarSesion,
    isAutenticado,
    obtenerDatosMe,
} from "../lib/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const router = useRouter();
  const { instance } = useMsal();

  // Estado para el menú hamburguesa
  const [menuOpen, setMenuOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    if (!isAutenticado()) {
      router.replace("/");
      return;
    }

    obtenerDatosMe()
      .then((usuario) => {
        setNombre(`${usuario.nombres} ${usuario.apellidos}`);
        setCodigo(usuario.codigo ?? null);
      })
      .catch(() => {
        router.replace("/");
      });
  }, [router]);

  const handleLogout = async () => {
    await cerrarSesion(instance);
    router.push("/");
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <main className="dashboard-main">
        <header className="dashboard-header">
          {/* Botón hamburguesa (solo visible en móviles) */}
          <button
            type="button"
            className="menu-button"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>

          <div style={{ display:"flex", flexDirection:"column", lineHeight:1.1}}>
            <h1 style={{ margin:0}}>Hola, {nombre || "..."}</h1>
            {codigo && <span style={{ fontSize:11, opacity:0.9, fontWeight:400}}>{codigo}</span>}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="dashboard-logout"
          >
            Cerrar sesión
          </button>
        </header>

        <section className="dashboard-content">
          {children}
        </section>
      </main>
    </div>
  );
}