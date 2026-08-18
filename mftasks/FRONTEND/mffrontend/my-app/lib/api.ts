import { obtenerAccessToken } from "./auth";
import { apiBaseUrl } from "./authConfig";

async function refrescarTokens(): Promise<boolean> {
    const refresh = localStorage.getItem("refresh");

    if (!refresh) return false;

    try {
        const res = await fetch(`${apiBaseUrl}/api/usuarios/auth/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
        });

        if (!res.ok) return false;

        const data = await res.json();

        localStorage.setItem("access", data.access);

        if (data.refresh) {
            localStorage.setItem("refresh", data.refresh);
        }

        return true;
    } catch {
        return false;
    }
}

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = new Headers(options.headers);

    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const token = obtenerAccessToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    let res = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401 && token) {
        const renovado = await refrescarTokens();

        if (renovado) {
            headers.set(
                "Authorization",
                `Bearer ${obtenerAccessToken() ?? ""}`
            );

            res = await fetch(`${apiBaseUrl}${path}`, {
                ...options,
                headers,
            });
        }
    }

    if (!res.ok) {
        let mensaje = `Error de API: ${res.status}`;

        try {
            const data = await res.json();

            if (data?.detail) {
                mensaje = data.detail;
            }
        } catch {
            // respuesta sin JSON
        }

        throw new Error(mensaje);
    }

    return res.json();
}