"use client";

import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { apiBaseUrl, loginRequest } from "./authConfig";
import {
    iniciarEpochSesion,
    limpiarEpochSesion,
    limpiarPersistenciaCliente,
    limpiarSsoRequiereInteraccion,
    marcarSsoRequiereInteraccion,
    notificarCierreSesion,
    obtenerEpochSesion,
} from "./persistencia";
import { aplicarTemaUsuario } from "./tema";

export type TipoUsuario = "COLABORADOR" | "ADMINISTRADOR";

export interface DatosUsuario {
    id: number;
    codigo?: string | null;
    email: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
    tipo_usuario?: TipoUsuario;
    nivel?: number | null;
    nivel_nombre?: string | null;
    nivel_color?: string | null;
    puede_crear_solicitudes?: boolean;
    puede_liderar?: boolean;
    es_aprobador?: boolean;
    disponibilidad?: {
        estado: "DISPONIBLE" | "INDISPONIBLE";
        fecha_inicio?: string | null;
        fecha_fin?: string | null;
        motivo?: string;
        fecha_actualizacion?: string;
    } | null;
}

export class ErrorDeSesion extends Error {}

function decodificarPayload(token: string): Record<string, unknown> | null {
    try {
        const parte = token.split(".")[1];
        if (!parte) return null;

        const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
        const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
        const json = decodeURIComponent(
            atob(base64 + relleno)
                .split("")
                .map(
                    (c) =>
                        "%" +
                        ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                )
                .join("")
        );

        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function tokenVigente(token: string | null): boolean {
    if (!token) return false;

    const payload = decodificarPayload(token);
    const exp = payload?.exp;

    if (typeof exp !== "number") return false;

    return exp * 1000 > Date.now() + 5000;
}

/**
 * True si hay una sesión aún vigente en este navegador (misma pestaña o
 * pestañas que comparten localStorage). Evita volver a iniciar sesión
 * mientras el usuario no haya cerrado sesión.
 */
export function sesionActiva(): boolean {
    if (typeof window === "undefined") return false;

    return (
        tokenVigente(localStorage.getItem("access")) ||
        tokenVigente(localStorage.getItem("refresh"))
    );
}

export function limpiarSesionLocal(): void {
    if (typeof window === "undefined") return;

    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    limpiarEpochSesion();
    limpiarPersistenciaCliente();
    notificarCierreSesion();
}

function guardarTokens(access: string, refresh: string): void {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
}

export function obtenerAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access");
}

export function getUsuarioActual(): DatosUsuario | null {
    if (typeof window === "undefined") return null;

    const guardado = localStorage.getItem("user");

    if (!guardado) return null;

    try {
        return JSON.parse(guardado) as DatosUsuario;
    } catch {
        return null;
    }
}

export function esAdmin(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    return usuario.tipo_usuario === "ADMINISTRADOR";
}

export function puedeCrearSolicitudes(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    return usuario.puede_crear_solicitudes === true;
}

export function esColaborador(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    return usuario.tipo_usuario === "COLABORADOR";
}

export function esAsignador(): boolean {
    return esAdmin();
}

export function esMiembro(): boolean {
    // Usuario interno por defecto (colaborador).
    return esColaborador();
}

/** True si el usuario puede liderar un equipo según el backend. */
export function esLiderElegible(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    return usuario.puede_liderar === true;
}

export function isAutenticado(): boolean {
    return sesionActiva();
}

export async function intercambiarToken(
    instance: IPublicClientApplication,
    cuenta: AccountInfo
): Promise<DatosUsuario> {
    const epoch = iniciarEpochSesion();

    const respuesta = await instance.acquireTokenSilent({
        ...loginRequest,
        account: cuenta,
    });

    const idToken = respuesta.idToken;

    if (!idToken) {
        throw new ErrorDeSesion(
            "No se obtuvo el token de identidad de Microsoft."
        );
    }

    const res = await fetch(`${apiBaseUrl}/api/usuarios/auth/microsoft/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new ErrorDeSesion(
            data.detail || "No se pudo iniciar sesión en el sistema."
        );
    }

    // Otra pestaña pudo cerrar la sesión mientras se resolvía el intercambio.
    if (obtenerEpochSesion() !== epoch) {
        throw new ErrorDeSesion(
            "La sesión se cerró en otra pestaña. Vuelve a iniciar sesión."
        );
    }

    const anterior = getUsuarioActual();

    if (anterior && anterior.id !== data.user.id) {
        limpiarPersistenciaCliente();
    }

    guardarTokens(data.access, data.refresh);
    localStorage.setItem("user", JSON.stringify(data.user));
    aplicarTemaUsuario(data.user.id);
    limpiarSsoRequiereInteraccion();

    return data.user as DatosUsuario;
}

export async function obtenerDatosMe(
    forceRefresh = false
): Promise<DatosUsuario> {
    const guardado = localStorage.getItem("user");
    let cache: DatosUsuario | null = null;

    if (guardado) {
        try {
            cache = JSON.parse(guardado) as DatosUsuario;
        } catch {
            cache = null;
        }
    }

    if (cache && !forceRefresh) {
        return cache;
    }

    try {
        const pedirMe = () =>
            fetch(`${apiBaseUrl}/api/usuarios/auth/me/`, {
                headers: {
                    Authorization: `Bearer ${obtenerAccessToken() ?? ""}`,
                },
            });

        let res = await pedirMe();

        if (
            (res.status === 401 || res.status === 403) &&
            obtenerAccessToken()
        ) {
            // El access token pudo expirar; intentar renovarlo antes de
            // declarar la sesión inválida.
            const { refrescarTokens } = await import("./api");

            if (await refrescarTokens()) {
                res = await pedirMe();
            }
        }

        if (res.status === 401 || res.status === 403) {
            throw new ErrorDeSesion(
                "No se pudo validar la sesión del usuario."
            );
        }

        if (!res.ok) {
            throw new Error("No se pudo obtener los datos del usuario.");
        }

        const usuario = (await res.json()) as DatosUsuario;

        localStorage.setItem("user", JSON.stringify(usuario));

        return usuario;
    } catch (e) {
        // Ante fallos de red o del servidor, conservar la identidad cacheada.
        if (!(e instanceof ErrorDeSesion) && cache) {
            return cache;
        }

        throw e;
    }
}

export async function cerrarSesion(
    instance: IPublicClientApplication
): Promise<void> {
    const refresh = localStorage.getItem("refresh");
    const access = localStorage.getItem("access");

    if (refresh) {
        try {
            await fetch(`${apiBaseUrl}/api/usuarios/auth/logout/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(access ? { Authorization: `Bearer ${access}` } : {}),
                },
                body: JSON.stringify({ refresh }),
            });
        } catch {
            // Si el backend no responde, igualmente limpiamos la sesión local.
        }
    }

    limpiarSesionLocal();
    marcarSsoRequiereInteraccion();

    await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
    });
}