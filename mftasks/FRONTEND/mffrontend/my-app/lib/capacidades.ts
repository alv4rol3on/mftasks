import type { DatosUsuario } from "./auth";
import type { EquipoInfo } from "./types";

export type Caps = {
  isAdmin: boolean;
  isCliente: boolean;
  isClientePuro: boolean;
  isAsignador: boolean;
  isLider: boolean;
  isSubLider: boolean;
  isMiembro: boolean;
  isAprobador: boolean;
};

/**
 * Deriva las capacidades del usuario a partir de sus datos de sesión y de
 * los equipos visibles. Fuente de verdad única para el menú y el guard de rutas.
 */
export function calcularCaps(
  user: DatosUsuario | null,
  equipos: EquipoInfo[] | null
): Caps {
  const roles = (user?.roles ?? []).map((r) => r.toLowerCase());
  const tipo = user?.tipo_usuario;

  const isAdmin = tipo === "ADMINISTRADOR" || roles.includes("administrador");
  const isCliente = tipo === "CLIENTE" || roles.includes("cliente");

  // Un colaborador es un usuario interno (con o sin equipo).
  const isColaborador = tipo ? tipo === "COLABORADOR" : !isAdmin && !isCliente;
  const isMiembroGlobal = isColaborador || roles.includes("miembro");
  const isAsignadorLegacy = roles.includes("asignador");
  // Aprobador dinámico: lo determina el backend por jerarquía + permiso.
  // Se conserva el respaldo por nombres para sesiones antiguas en caché.
  const isAprobador =
    Boolean(user?.es_aprobador) ||
    ["gerente", "subgerente", "jefe"].some((r) => roles.includes(r));
  const isAsignador = isAdmin || isAsignadorLegacy || isAprobador;

  let isLider = false;
  let isSubLider = false;
  let isMiembro = isMiembroGlobal;

  if (equipos && user) {
    const uid = user.id;
    for (const eq of equipos) {
      if (eq.lider?.id === uid) {
        isLider = true;
        isMiembro = true;
      }
      if (
        eq.puedo_gestionar &&
        (eq.lider?.id === uid || eq.mi_rol_en_equipo === "LIDER")
      ) {
        isLider = true;
      }
      if (eq.mi_rol_en_equipo === "LIDER") {
        isLider = true;
        isMiembro = true;
      }
      if (eq.mi_rol_en_equipo === "SUB_LIDER") {
        isSubLider = true;
        isMiembro = true;
      }
      if (
        eq.mi_rol_en_equipo === "MIEMBRO" ||
        eq.mi_rol_en_equipo === "SUB_LIDER" ||
        eq.mi_rol_en_equipo === "LIDER" ||
        eq.lider?.id === uid
      ) {
        isMiembro = true;
      }
      if (eq.miembros?.some((m) => m.id_usuario === uid)) {
        isMiembro = true;
      }
    }
    if (
      !isSubLider &&
      equipos.some((eq) =>
        eq.miembros?.some(
          (m) =>
            m.id_usuario === user.id &&
            m.rol_en_equipo === "LIDER" &&
            m.estado === "ACTIVO"
        )
      )
    ) {
      isLider = true;
      isMiembro = true;
    }
  } else if (!equipos) {
    if (!isCliente && isMiembroGlobal) isMiembro = true;
    if (!isCliente && isAsignadorLegacy) isMiembro = true;
  }

  const isClientePuro = isCliente && !isAdmin && !isLider && !isSubLider && !isMiembro;

  return {
    isAdmin,
    isCliente,
    isClientePuro,
    isAsignador,
    isLider,
    isSubLider,
    isMiembro,
    isAprobador,
  };
}

/**
 * Rutas protegidas de /mfpages y su predicado de acceso.
 * El orden no importa: se resuelve por el prefijo más específico.
 */
export const RUTAS_PROTEGIDAS: { ruta: string; permitido: (c: Caps) => boolean }[] = [
  { ruta: "/mfpages/perfil", permitido: () => true },
  { ruta: "/mfpages/equipos", permitido: () => true },
  { ruta: "/mfpages/admin", permitido: (c) => c.isAdmin },
  { ruta: "/mfpages/solicitudes", permitido: (c) => c.isAdmin || !c.isClientePuro },
  { ruta: "/mfpages/tareas", permitido: (c) => c.isAdmin || !c.isClientePuro },
  {
    ruta: "/mfpages/cliente/mis-solicitudes",
    permitido: (c) => c.isCliente || c.isAdmin,
  },
];

/** Indica si el pathname está permitido para las capacidades dadas. */
export function rutaPermitida(pathname: string, caps: Caps): boolean {
  const match = RUTAS_PROTEGIDAS.filter(
    (r) => pathname === r.ruta || pathname.startsWith(`${r.ruta}/`)
  ).sort((a, b) => b.ruta.length - a.ruta.length)[0];

  if (!match) return true;
  return match.permitido(caps);
}
