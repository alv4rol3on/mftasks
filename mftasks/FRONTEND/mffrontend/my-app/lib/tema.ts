export type Tema = "light" | "dark";

export const CLAVE_TEMA = "tema";

export function claveTemaUsuario(usuarioId: number | null): string {
    return `${CLAVE_TEMA}:u${usuarioId ?? "anon"}`;
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

/** Aplica el tema propio del usuario actual. */
export function aplicarTemaUsuario(usuarioId: number | null): Tema {
    const tema = leerTemaUsuario(usuarioId);

    aplicarTema(tema);

    return tema;
}

/**
 * Se inyecta antes del primer paint. La pantalla de login siempre queda clara;
 * las rutas internas arrancan con el tema del usuario autenticado para evitar
 * el destello de tema claro al recargar.
 */
export const SCRIPT_TEMA = `
(function () {
    function aplicarClaro() {
        document.documentElement.dataset.theme = "light";
    }

    try {
        var ruta = window.location.pathname.replace(/\\/+$/, "");

        if (!ruta) {
            aplicarClaro();
            return;
        }

        var raw = localStorage.getItem("user");

        if (!raw) {
            aplicarClaro();
            return;
        }

        var usuario = JSON.parse(raw);
        var tema = localStorage.getItem("tema:u" + usuario.id);

        document.documentElement.dataset.theme =
            tema === "dark" ? "dark" : "light";
    } catch (e) {
        aplicarClaro();
    }
})();
`;
