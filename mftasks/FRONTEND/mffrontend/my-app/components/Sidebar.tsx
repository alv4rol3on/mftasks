"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import "../components/Sidebar.css";
import { useCapacidades } from "./CapacidadesProvider";
import type { Caps } from "@/lib/capacidades";

type MenuItem = {
  nombre: string;
  ruta: string;
  show: (caps: Caps) => boolean;
};

const menuAll: MenuItem[] = [
  { nombre: "Perfil", ruta: "/mfpages/perfil", show: () => true },
  // CLIENTE: ve estado de sus solicitudes
  { nombre: "Seguimiento de Solicitudes", ruta: "/mfpages/cliente/mis-solicitudes", show: (c) => c.isCliente },
  // Para admin: Centro de solicitudes (seguimiento de todos los estados, solo lectura)
  { nombre: "Centro de solicitudes", ruta: "/mfpages/solicitudes", show: (c) => c.isAdmin },
  // Personal interno no-admin
  { nombre: "Bandeja de solicitudes", ruta: "/mfpages/solicitudes", show: (c) => !c.isAdmin && !c.isClientePuro && (c.isAsignador || c.isLider || c.isSubLider || c.isMiembro) },
  { nombre: "Tareas en desarrollo", ruta: "/mfpages/tareas", show: (c) => c.isAdmin || (!c.isClientePuro && (c.isAsignador || c.isLider || c.isSubLider || c.isMiembro)) },
  { nombre: "Equipos", ruta: "/mfpages/equipos", show: () => true },
  { nombre: "Administración de usuarios/campañas", ruta: "/mfpages/admin", show: (c) => c.isAdmin },
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
  const { caps } = useCapacidades();

  const menu = useMemo(() => menuAll.filter((m) => m.show(caps)), [caps]);

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
