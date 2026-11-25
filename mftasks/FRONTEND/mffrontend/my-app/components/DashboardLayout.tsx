"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import Sidebar from "./Sidebar";
import CapacidadesProvider from "./CapacidadesProvider";
import CatalogosProvider from "./CatalogosProvider";
import GuardRuta from "./GuardRuta";
import "../components/DashboardLayout.css";
import {
  cerrarSesion,
  ErrorDeSesion,
  getUsuarioActual,
  isAutenticado,
  limpiarSesionLocal,
  obtenerDatosMe,
} from "../lib/auth";
import { marcarSsoRequiereInteraccion } from "../lib/persistencia";
import {
  aplicarTema,
  guardarTemaUsuario,
  leerTemaUsuario,
  type Tema,
} from "../lib/tema";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_PINNED_KEY = "mftasks-sidebar-pinned";

function tituloParaRuta(pathname: string): string | null {
  // La página de administración controla su propio título según la pestaña.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  if (pathname.startsWith("/tareas/") && pathname.endsWith("/iniciar")) {
    return "Iniciar tarea · MF Tasks";
  }
  if (pathname.startsWith("/tareas/")) return "Detalle de tarea · MF Tasks";
  if (pathname.startsWith("/tareas")) return "Tareas en desarrollo · MF Tasks";
  if (pathname.startsWith("/solicitudes")) return "Solicitudes · MF Tasks";
  if (pathname.startsWith("/equipos")) return "Equipos · MF Tasks";
  if (pathname.startsWith("/perfil")) return "Perfil · MF Tasks";
  if (pathname.startsWith("/cliente/mis-solicitudes")) {
    return "Seguimiento de solicitudes · MF Tasks";
  }
  return "MF Tasks";
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { instance } = useMsal();

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    const titulo = tituloParaRuta(pathname);
    if (titulo) document.title = titulo;
  }, [pathname]);

  // Recuperar la preferencia de fijación guardada en este navegador.
  useEffect(() => {
    setSidebarPinned(localStorage.getItem(SIDEBAR_PINNED_KEY) === "true");
    setSidebarPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    localStorage.setItem(SIDEBAR_PINNED_KEY, String(sidebarPinned));
  }, [sidebarPinned, sidebarPreferenceLoaded]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const usuarioId = getUsuarioActual()?.id ?? null;
    const temaInicial = leerTemaUsuario(usuarioId);
    aplicarTema(temaInicial);
    setTema(temaInicial);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const alternarTema = () => {
    const nuevoTema = tema === "dark" ? "light" : "dark";
    const usuarioId = getUsuarioActual()?.id ?? null;
    guardarTemaUsuario(usuarioId, nuevoTema);
    aplicarTema(nuevoTema);
    setTema(nuevoTema);
  };

  useEffect(() => {
    if (!isAutenticado()) {
      router.replace("/");
      return;
    }

    let cancelado = false;
    obtenerDatosMe(true)
      .then((usuario) => {
        if (cancelado) return;
        setNombre(`${usuario.nombres} ${usuario.apellidos}`);
        setCodigo(usuario.codigo ?? null);
      })
      .catch((e) => {
        if (cancelado) return;
        if (e instanceof ErrorDeSesion) {
          marcarSsoRequiereInteraccion();
          limpiarSesionLocal();
          router.replace("/");
          return;
        }
        // Error de red/servidor: conservar la identidad cacheada.
        const usuario = getUsuarioActual();
        if (!usuario) return;
        setNombre(`${usuario.nombres} ${usuario.apellidos}`);
        setCodigo(usuario.codigo ?? null);
      });

    return () => { cancelado = true; };
  }, [router]);

  const handleLogout = async () => {
    await cerrarSesion(instance);
    router.push("/");
  };

  return (
    <CapacidadesProvider>
      <CatalogosProvider>
        <div className={`dashboard-layout ${menuOpen ? "sidebar-open" : ""} ${sidebarPinned ? "sidebar-pinned" : ""}`}>
          <Sidebar
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            pinned={sidebarPinned}
            setPinned={setSidebarPinned}
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
                  onClick={() => setMenuOpen((actual) => !actual)}
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
                  aria-label={tema === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
                  title={tema === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
                >
                  {tema === "dark" ? "🌙" : "☀️"}
                </button>

                <button type="button" onClick={handleLogout} className="dashboard-logout">
                  Cerrar sesión
                </button>
              </div>
            </header>

            <section key={pathname} className="dashboard-content">
              <GuardRuta>{children}</GuardRuta>
            </section>
          </main>
        </div>
      </CatalogosProvider>
    </CapacidadesProvider>
  );
}
