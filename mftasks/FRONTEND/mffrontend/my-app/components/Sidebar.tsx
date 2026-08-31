"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "../components/Sidebar.css";
import { getUsuarioActual } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { EquipoInfo } from "@/lib/types";

type MenuItem = {
  nombre: string;
  ruta: string;
  show: (caps: Caps) => boolean;
};

type Caps = {
  isAdmin: boolean;
  isCliente: boolean;
  isClientePuro: boolean;
  isAsistente: boolean;
  isAsignador: boolean;
  isLider: boolean;
  isSubLider: boolean;
  isMiembro: boolean;
};

const menuAll: MenuItem[] = [
  { nombre: "Inicio", ruta: "/mfpages/home", show: () => true },
  // CLIENTE: ve estado de sus solicitudes
  { nombre: "Mis Solicitudes", ruta: "/mfpages/cliente/mis-solicitudes", show: (c) => c.isCliente },
  // ASISTENTE: ver pero no aprobar | SUB-LIDER/LIDER: aprobar | ADMIN/ASIGNADOR: aprobar
  // Visible para todo el personal interno (asistente, asignador, lider, sub-lider, admin) pero NO para cliente puro
  { nombre: "Centro de solicitudes", ruta: "/mfpages/solicitudes", show: (c) => !c.isClientePuro && (c.isAsistente || c.isAsignador || c.isAdmin || c.isLider || c.isSubLider || c.isMiembro) },
  { nombre: "Tareas en desarrollo", ruta: "/mfpages/tareas", show: (c) => !c.isClientePuro && (c.isAsistente || c.isAsignador || c.isAdmin || c.isLider || c.isSubLider || c.isMiembro) },
  { nombre: "Equipos", ruta: "/mfpages/equipos", show: () => true },
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
  const [equipos, setEquipos] = useState<EquipoInfo[] | null>(null);

  useEffect(() => {
    // Cargar equipos para detectar LIDER / SUB-LIDER / Miembro (necesario cuando el usuario no tiene rol global ASIGNADOR)
    let cancel = false;
    const user = getUsuarioActual();
    if (!user) return;
    apiFetch<EquipoInfo[] | { results: EquipoInfo[] }>("/api/usuarios/equipos/")
      .then((data) => {
        if (cancel) return;
        const arr = Array.isArray(data) ? data : (data as { results: EquipoInfo[] }).results ?? [];
        setEquipos(arr);
      })
      .catch(() => {
        if (!cancel) setEquipos([]);
      });
    return () => { cancel = true; };
  }, [pathname]);

  const menu = useMemo(() => {
    const user = getUsuarioActual();
    const roles = (user?.roles ?? []).map((r) => r.toLowerCase());
    const isAdmin = roles.includes("administrador");
    const isCliente = roles.includes("cliente");
    const isMiembroGlobal = roles.includes("miembro");
    // compat: viejo asignador/asistente mapean a miembro
    const isAsistenteExplicit = roles.includes("asistente");
    const isAsignadorLegacy = roles.includes("asignador");
    const isAsistente = false; // deprecado
    const isAsignador = isAdmin || isAsignadorLegacy;

    let isLider = false;
    let isSubLider = false;
    let isMiembro = isMiembroGlobal;
    if (equipos && user) {
      const uid = user.id;
      for (const eq of equipos) {
        if (eq.lider?.id === uid) { isLider = true; isMiembro = true; }
        if (eq.puedo_gestionar && (eq.lider?.id === uid || eq.mi_rol_en_equipo === "LIDER")) isLider = true;
        if (eq.mi_rol_en_equipo === "LIDER") { isLider = true; isMiembro = true; }
        if (eq.mi_rol_en_equipo === "SUB_LIDER") { isSubLider = true; isMiembro = true; } // compat
        if (eq.mi_rol_en_equipo === "MIEMBRO" || eq.mi_rol_en_equipo === "SUB_LIDER" || eq.mi_rol_en_equipo === "LIDER" || eq.lider?.id === uid) isMiembro = true;
        if (eq.miembros?.some((m) => m.id_usuario === uid)) isMiembro = true;
      }
      if (!isSubLider && equipos.some((eq) => eq.miembros?.some((m) => m.id_usuario === user.id && m.rol_en_equipo === "LIDER" && m.estado === "ACTIVO"))) {
        isLider = true; isMiembro = true;
      }
    } else if (!equipos) {
      if (!isCliente && isMiembroGlobal) isMiembro = true;
      if (!isCliente && isAsignadorLegacy) isMiembro = true;
    }

    const isClientePuro = isCliente && !isAdmin && !isLider && !isSubLider && !isMiembro;
    const caps: Caps = { isAdmin, isCliente, isClientePuro, isAsistente, isAsignador, isLider, isSubLider, isMiembro };

    // Deduplicar por nombre/ruta: hay dos entradas "Centro de solicitudes" con rutas distintas
    // Filtramos por show y luego por unicidad de ruta
    const filtrado = menuAll.filter((m) => m.show(caps));
    // Si es admin, mostrar ambas variantes de centro (mis solicitudes no tiene sentido para admin sin cliente, pero lo mostramos si es cliente también)
    // Para evitar duplicado visual, si hay dos con mismo nombre pero distinta ruta, mantener ambas
    return filtrado;
  }, [pathname, equipos]);

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