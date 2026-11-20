const PREFIJO_PERSISTENCIA = "mftasks:";
const PREFIJO_EPOCH = "mftasks:epoch";
const CLAVE_SSO_INTERACCION = "mftasks:sso-requiere-interaccion";

const CLAVES_LEGACY = [
    "mftasks:tareas:filtros",
    "mftasks-snapMap-v1",
];

export const EVENTO_SESION_CERRADA = "mftasks:sesion-cerrada";

export function clavePersistencia(
    nombre: string,
    usuarioId?: number | null
): string {
    return `${PREFIJO_PERSISTENCIA}${nombre}:u${usuarioId ?? "anon"}`;
}

export function leerJson<T>(clave: string): T | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = sessionStorage.getItem(clave);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export function guardarJson(clave: string, valor: unknown): void {
    if (typeof window === "undefined") return;

    try {
        sessionStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        // Sin persistencia si sessionStorage no está disponible.
    }
}

/** Elimina las claves de versiones anteriores que no estaban asociadas al usuario. */
export function limpiarPersistenciaLegacy(): void {
    if (typeof window === "undefined") return;

    try {
        for (const clave of CLAVES_LEGACY) sessionStorage.removeItem(clave);
    } catch {
        // Sin persistencia si sessionStorage no está disponible.
    }
}

/**
 * Borra todo el estado de UI persistido en esta pestaña. No toca la caché de
 * MSAL: esa se limpia en el proveedor que tiene acceso a la instancia.
 */
export function limpiarPersistenciaCliente(): void {
    if (typeof window === "undefined") return;

    try {
        const claves: string[] = [];

        for (let i = 0; i < sessionStorage.length; i += 1) {
            const clave = sessionStorage.key(i);
            if (
                clave &&
                (clave.startsWith(PREFIJO_PERSISTENCIA) ||
                    CLAVES_LEGACY.includes(clave))
            ) {
                claves.push(clave);
            }
        }

        for (const clave of claves) sessionStorage.removeItem(clave);
        limpiarPersistenciaLegacy();
    } catch {
        // Sin persistencia si sessionStorage no está disponible.
    }
}

/** Notifica a los componentes de la misma pestaña que la sesión terminó. */
export function notificarCierreSesion(): void {
    if (typeof window === "undefined") return;

    window.dispatchEvent(new Event(EVENTO_SESION_CERRADA));
}

/** Suscribe un callback al cierre de sesión de la pestaña actual. */
export function alCerrarSesion(callback: () => void): () => void {
    if (typeof window === "undefined") return () => {};

    window.addEventListener(EVENTO_SESION_CERRADA, callback);

    return () => {
        window.removeEventListener(EVENTO_SESION_CERRADA, callback);
    };
}

export function obtenerEpochSesion(): string | null {
    if (typeof window === "undefined") return null;

    try {
        return localStorage.getItem(PREFIJO_EPOCH);
    } catch {
        return null;
    }
}

export function iniciarEpochSesion(): string {
    const epoch =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
        localStorage.setItem(PREFIJO_EPOCH, epoch);
    } catch {
        // Sin epoch si localStorage no está disponible.
    }

    return epoch;
}

export function limpiarEpochSesion(): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem(PREFIJO_EPOCH);
    } catch {
        // Sin epoch si localStorage no está disponible.
    }
}

/**
 * Tras un logout o una sesión expirada, el login no debe reutilizar
 * silenciosamente la cuenta MSAL que quedó en el navegador.
 */
export function marcarSsoRequiereInteraccion(): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(CLAVE_SSO_INTERACCION, "1");
    } catch {
        // Sin marca si localStorage no está disponible.
    }
}

export function ssoRequiereInteraccion(): boolean {
    if (typeof window === "undefined") return false;

    try {
        return localStorage.getItem(CLAVE_SSO_INTERACCION) === "1";
    } catch {
        return false;
    }
}

export function limpiarSsoRequiereInteraccion(): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem(CLAVE_SSO_INTERACCION);
    } catch {
        // Sin marca si localStorage no está disponible.
    }
}
