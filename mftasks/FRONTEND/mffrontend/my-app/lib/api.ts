import { obtenerAccessToken } from "./auth";
import { apiBaseUrl } from "./authConfig";

export async function refrescarTokens(): Promise<boolean> {
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

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    const token = obtenerAccessToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const cache = options.cache ?? "no-store";
    let res = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers,
        cache,
    } as RequestInit);

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
                cache,
            } as RequestInit);
        }
    }

    if (!res.ok) {
        let mensaje = `Error de API: ${res.status}`;

        try {
            const data = await res.json();

            if (data?.detail) {
                mensaje = data.detail;
            } else if (data && typeof data === "object") {
                // DRF validation errors como {subcampana: [...]}
                const firstKey = Object.keys(data)[0];
                const valores = data as Record<string, unknown>;
                if (firstKey && Array.isArray(valores[firstKey])) {
                    mensaje = `${firstKey}: ${valores[firstKey][0]}`;
                }
            }
        } catch {
            // respuesta sin JSON
        }

        throw new Error(mensaje);
    }

    if (res.status === 204) {
        return {} as T;
    }

    const text = await res.text();
    if (!text) return {} as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return {} as T;
    }
}

/** Descarga binaria autenticada (p. ej. ZIP de adjuntos). */
export async function apiFetchBlob(path: string): Promise<Blob> {
    const headers = new Headers();
    const token = obtenerAccessToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    let res = await fetch(`${apiBaseUrl}${path}`, { headers, cache: "no-store" });

    if (res.status === 401 && token) {
        const renovado = await refrescarTokens();

        if (renovado) {
            headers.set(
                "Authorization",
                `Bearer ${obtenerAccessToken() ?? ""}`
            );
            res = await fetch(`${apiBaseUrl}${path}`, { headers, cache: "no-store" });
        }
    }

    if (!res.ok) {
        let mensaje = `Error de API: ${res.status}`;

        try {
            const data = await res.json();
            if (data?.detail) mensaje = data.detail;
        } catch {
            // respuesta sin JSON
        }

        throw new Error(mensaje);
    }

    return res.blob();
}