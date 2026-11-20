export type Tema = "light" | "dark";

export const CLAVE_TEMA = "tema";

export function leerTema(): Tema {
    if (typeof window === "undefined") return "light";

    try {
        return localStorage.getItem(CLAVE_TEMA) === "dark" ? "dark" : "light";
    } catch {
        return "light";
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
