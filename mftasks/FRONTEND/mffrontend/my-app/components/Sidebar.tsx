"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import "../components/Sidebar.css";
import { useCapacidades } from "./CapacidadesProvider";
import type { Caps } from "@/lib/capacidades";

type MenuItem = {
  nombre: string;
  ruta: string;
  show: (caps: Caps) => boolean;
};

const menuAll: MenuItem[] = [
  { nombre: "Perfil", ruta: "/perfil", show: () => true },
  // CLIENTE: ve estado de sus solicitudes
  { nombre: "Seguimiento de Solicitudes", ruta: "/cliente/mis-solicitudes", show: (c) => c.isCliente && !c.isAdmin },
  // Para admin: Centro de solicitudes (seguimiento de todos los estados, solo lectura)
  { nombre: "Centro de solicitudes", ruta: "/solicitudes", show: (c) => c.isAdmin },
  { nombre: "Administración general", ruta: "/admin", show: (c) => c.isAdmin },
  // Personal interno no-admin
  { nombre: "Bandeja de solicitudes", ruta: "/solicitudes", show: (c) => !c.isAdmin && !c.isClientePuro && (c.isAsignador || c.isLider || c.isSubLider || c.isMiembro) },
  { nombre: "Tareas en desarrollo", ruta: "/tareas", show: (c) => !c.isAdmin && !c.isClientePuro && (c.isAsignador || c.isLider || c.isSubLider || c.isMiembro) },
  { nombre: "Equipos", ruta: "/equipos", show: () => true },
];

interface SidebarProps {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pinned: boolean;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({
  menuOpen,
  setMenuOpen,
  pinned,
  setPinned,
}: SidebarProps) {
  const pathname = usePathname();
  const { caps } = useCapacidades();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const visible = pinned || menuOpen;

  const menu = useMemo(() => menuAll.filter((m) => m.show(caps)), [caps]);

  // Al navegar se cierra el menú temporal, pero el sidebar fijado permanece visible.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  useEffect(() => {
    if (menuOpen && !pinned) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    } else if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [menuOpen, pinned]);

  // Bloquear scroll y permitir cerrar con Escape solo cuando el menú es temporal.
  useEffect(() => {
    if (!menuOpen || pinned) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, pinned, setMenuOpen]);

  const alternarFijado = () => {
    setPinned((actual) => !actual);
    setMenuOpen(false);
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${menuOpen && !pinned ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="sidebar"
        className={`sidebar ${visible ? "open" : ""} ${pinned ? "pinned" : ""}`}
        aria-hidden={!visible}
      >
        <div className="sidebar-toolbar">
          <button
            type="button"
            className={`sidebar-pin ${pinned ? "is-pinned" : ""}`}
            aria-label={pinned ? "Desfijar barra lateral" : "Fijar barra lateral"}
            aria-pressed={pinned}
            title={pinned ? "Desfijar barra lateral" : "Fijar barra lateral"}
            onClick={alternarFijado}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M16 3 21 8l-3 1-4 4v4l-2 2-2-6-5-5 2-2 5 5 4-4z" />
              <path d="m5 19 5-5" />
            </svg>
          </button>

          <button
            ref={closeButtonRef}
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="sidebar-logo-container">
          <img src="/mfsac.png" alt="MF SAC" className="sidebar-logo" />
        </div>

        <nav className="sidebar-nav">
          {menu.map((item) => {
            const activo =
              pathname === item.ruta || pathname.startsWith(`${item.ruta}/`);

            return (
              <Link
                key={item.ruta}
                href={item.ruta}
                className={`sidebar-link ${activo ? "active" : ""}`}
                aria-current={activo ? "page" : undefined}
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
