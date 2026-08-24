"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import "../components/Sidebar.css";
import { getUsuarioActual } from "@/lib/auth";

const menuAll = [
  { nombre: "Inicio", ruta: "/mfpages/home", roles: ["all"] },
  { nombre: "Mis Solicitudes", ruta: "/mfpages/cliente/mis-solicitudes", roles: ["cliente"] },
  { nombre: "Tareas en desarrollo", ruta: "/mfpages/tareas", roles: ["asignador", "asistente", "administrador"] },
  { nombre: "Centro de solicitudes", ruta: "/mfpages/solicitudes", roles: ["asignador", "administrador"] },
  { nombre: "Equipos", ruta: "/mfpages/equipos", roles: ["cliente", "asignador"] },
  { nombre: "Administración de asistentes", ruta: "/mfpages/asistentes", roles: ["administrador", "asignador"] },
];

interface SidebarProps {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({
  menuOpen,
  setMenuOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const menu = useMemo(() => {
    const user = getUsuarioActual();
    const roles = (user?.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.includes("administrador");
    if (isAdmin) return menuAll;
    if (roles.includes("cliente") && !roles.includes("asignador") && !roles.includes("asistente")) {
      return menuAll.filter((m) => m.roles.includes("cliente") || m.roles.includes("all"));
    }
    return menuAll.filter((m) => {
      if (m.roles.includes("all")) return true;
      return m.roles.some((r) => roles.includes(r));
    });
  }, [pathname]);

  // Bloquear scroll del body cuando el menú fullscreen está abierto (solo móvil)
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMenuOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [menuOpen, setMenuOpen]);

  return (
    <>
      {/* Fondo oscuro */}
      <div
        className={`sidebar-overlay ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside id="sidebar" className={`sidebar ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen ? true : undefined}>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        >
          ✕
        </button>
        <div className="sidebar-logo-container">
          <div className="sidebar-logo">
            LOGO
          </div>
        </div>

        <nav className="sidebar-nav">
          {menu.map((item) => {
            const activo = pathname === item.ruta;

            return (
              <Link
                key={item.ruta}
                href={item.ruta}
                className={`sidebar-link ${activo ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.nombre}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}