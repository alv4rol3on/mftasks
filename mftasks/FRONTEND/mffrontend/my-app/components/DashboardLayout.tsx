"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import Sidebar from "./Sidebar";
import CapacidadesProvider from "./CapacidadesProvider";
import GuardRuta from "./GuardRuta";
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
  const pathname = usePathname();
  const { instance } = useMsal();

  // Estado para el menú hamburguesa
  const [menuOpen, setMenuOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);

  const [tema, setTema] = useState<"light" | "dark">("light");



  useEffect(() => {
    const temaGuardado = localStorage.getItem("tema");
    const temaInicial = temaGuardado === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = temaInicial;
    setTema(temaInicial);
  }, []);

  const alternarTema = () => {
    const nuevoTema = tema === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = nuevoTema;
    localStorage.setItem("tema", nuevoTema);
    setTema(nuevoTema);
  };


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
    <CapacidadesProvider>
      <div className={`dashboard-layout ${menuOpen ? "sidebar-open" : ""}`}>
        <Sidebar
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />

        <main className="dashboard-main">
          <header className="dashboard-header">
            <div className="dashboard-header-left">
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

              <div className="dashboard-user">
                <h1>Hola, {nombre || "..."}</h1>
                {codigo && <span>{codigo}</span>}
              </div>
            </div>


            <div className="dashboard-header-actions">
              <button
                type="button"
                className="dashboard-theme-toggle"
                onClick={alternarTema}
                aria-label={
                  tema === "dark"
                    ? "Activar modo claro"
                    : "Activar modo noche"
                }
                title={
                  tema === "dark"
                    ? "Activar modo claro"
                    : "Activar modo noche"
                }
              >
                {tema === "dark" ? "🌙" : "☀️"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="dashboard-logout"
              >
                Cerrar sesión
              </button>
            </div>

          </header>

          <section key={pathname} className="dashboard-content">
            <GuardRuta>{children}</GuardRuta>
          </section>
        </main>
      </div>
    </CapacidadesProvider>
  );
}