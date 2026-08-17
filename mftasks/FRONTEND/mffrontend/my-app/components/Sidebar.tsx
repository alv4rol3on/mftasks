"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "../components/Sidebar.css";

const menu = [
  { nombre: "Inicio", ruta: "/mfpages/home" },
  { nombre: "Tareas en desarrollo", ruta: "/mfpages/tareas" },
  { nombre: "Centro de solicitudes", ruta: "/mfpages/solicitudes" },
  { nombre: "Administración de asistentes", ruta: "/mfpages/asistentes" },
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

  return (
    <>
      {/* Fondo oscuro */}
      <div
        className={`sidebar-overlay ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
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