"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import "../components/DashboardLayout.css";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const router = useRouter();

  // Estado para el menú hamburguesa
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    // Eliminar los tokens almacenados
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    // Redirigir al login
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
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>

          <h1>Hola, &lt;Nombre de usuario&gt;</h1>

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