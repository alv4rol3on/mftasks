"use client";

import { useEffect, useState, useRef } from "react";
import {
    PublicClientApplication,
} from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/lib/authConfig";

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [msalInstance, setMsalInstance] =
        useState<PublicClientApplication | null>(null);
    const manejado = useRef(false);

    useEffect(() => {
        const initializeMsal = async () => {
            const instance = new PublicClientApplication(msalConfig);

            await instance.initialize();

            if (!manejado.current) {
                manejado.current = true;

                const resultado =
                    await instance.handleRedirectPromise();

                if (resultado?.account) {
                    instance.setActiveAccount(resultado.account);
                }
            }

            setMsalInstance(instance);
        };

        initializeMsal();
    }, []);

    // Si otra pestaña cierra sesión, esta pestaña también debe olvidar la
    // cuenta de MSAL y reiniciar todo el estado en memoria.
    useEffect(() => {
        if (!msalInstance) return;

        let recargaProgramada: ReturnType<typeof setTimeout> | null = null;

        const reiniciarPestana = () => {
            if (recargaProgramada) clearTimeout(recargaProgramada);

            recargaProgramada = setTimeout(async () => {
                recargaProgramada = null;

                if (
                    localStorage.getItem("access") ||
                    localStorage.getItem("refresh")
                ) {
                    return;
                }

                try {
                    await msalInstance.clearCache();
                } catch {
                    // Si falla, la recarga igualmente reinicia el estado en memoria.
                }

                if (window.location.pathname === "/") {
                    window.location.reload();
                } else {
                    window.location.replace("/");
                }
            }, 50);
        };

        const alCambiarStorage = (evento: StorageEvent) => {
            if (
                evento.key !== "access" &&
                evento.key !== "refresh" &&
                evento.key !== null
            ) {
                return;
            }

            if (
                !localStorage.getItem("access") &&
                !localStorage.getItem("refresh")
            ) {
                reiniciarPestana();
            }
        };

        window.addEventListener("storage", alCambiarStorage);

        return () => {
            window.removeEventListener("storage", alCambiarStorage);
            if (recargaProgramada) clearTimeout(recargaProgramada);
        };
    }, [msalInstance]);

    if (!msalInstance) {
        return null;
    }

    return (
        <MsalProvider instance={msalInstance}>
            {children}
        </MsalProvider>
    );
}