"use client";

import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { apiBaseUrl, loginRequest } from "./authConfig";

export interface DatosUsuario {
    id: number;
    email: string;
    nombres: string;
    apellidos: string;
    cargo?: string;
    roles?: string[];
}

export class ErrorDeSesion extends Error {}

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

function rolesLower(roles?: string[]) {
    return (roles ?? []).map((r) => r.toLowerCase());
}

export function esAdmin(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    return rolesLower(usuario.roles).includes("administrador");
}

export function esAsignador(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    const roles = rolesLower(usuario.roles);
    if (roles.includes("administrador")) return true;
    return roles.includes("asignador");
}

export function esAsistente(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    const roles = rolesLower(usuario.roles);
    if (roles.includes("administrador") || roles.includes("asignador") || roles.includes("cliente")) return false;
    return roles.includes("asistente") || roles.length === 0;
}

export function esCliente(): boolean {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    return rolesLower(usuario.roles).includes("cliente");
}

export function isAutenticado(): boolean {
    return Boolean(obtenerAccessToken());
}

export async function intercambiarToken(
    instance: IPublicClientApplication,
    cuenta: AccountInfo
): Promise<DatosUsuario> {
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

    guardarTokens(data.access, data.refresh);
    localStorage.setItem("user", JSON.stringify(data.user));

    return data.user as DatosUsuario;
}

export async function obtenerDatosMe(): Promise<DatosUsuario> {
    const guardado = localStorage.getItem("user");

    if (guardado) {
        return JSON.parse(guardado) as DatosUsuario;
    }

    const res = await fetch(`${apiBaseUrl}/api/usuarios/auth/me/`, {
        headers: {
            Authorization: `Bearer ${obtenerAccessToken() ?? ""}`,
        },
    });

    if (!res.ok) {
        throw new ErrorDeSesion("No se pudo obtener los datos del usuario.");
    }

    const usuario = (await res.json()) as DatosUsuario;

    localStorage.setItem("user", JSON.stringify(usuario));

    return usuario;
}

export async function cerrarSesion(
    instance: IPublicClientApplication
): Promise<void> {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");

    await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
    });
}