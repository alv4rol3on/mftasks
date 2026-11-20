export type Tema = "light" | "dark";

export const CLAVE_TEMA = "tema";

export function claveTemaUsuario(usuarioId: number | null): string {
    return `${CLAVE_TEMA}:u${usuarioId ?? "anon"}`;
}

export function leerTema(): Tema {
    if (typeof window === "undefined") return "light";

    try {
        return localStorage.getItem(CLAVE_TEMA) === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
}

export function leerTemaUsuario(usuarioId: number | null): Tema {
    if (typeof window === "undefined") return "light";

    try {
        const guardado = localStorage.getItem(claveTemaUsuario(usuarioId));
        return guardado === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
}

export function guardarTemaUsuario(
    usuarioId: number | null,
    tema: Tema
): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(claveTemaUsuario(usuarioId), tema);
    } catch {
        // Sin persistencia si localStorage no está disponible.
    }
}

export function aplicarTema(tema: Tema): void {
    if (typeof document === "undefined") return;

    document.documentElement.dataset.theme = tema;
}

export function guardarTema(tema: Tema): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
        // Sin persistencia si localStorage no está disponible.
    }
}

/**
 * Aplica el tema propio del usuario y sincroniza la clave global que usa el
 * script previo al paint (pantalla de login y recargas).
 */
export function aplicarTemaUsuario(usuarioId: number | null): Tema {
    const tema = leerTemaUsuario(usuarioId);

    aplicarTema(tema);
    guardarTema(tema);

    return tema;
}

/**
 * Se inyecta antes del primer paint para evitar el destello de tema claro
 * al cargar el login o cualquier ruta tras un logout.
 */
export const SCRIPT_TEMA = `
(function () {
    try {
        var tema = localStorage.getItem("tema");
        document.documentElement.dataset.theme = tema === "dark" ? "dark" : "light";
    } catch (e) {
        document.documentElement.dataset.theme = "light";
    }
})();
`;
