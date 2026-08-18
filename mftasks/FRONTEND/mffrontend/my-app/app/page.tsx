"use client";

import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useRouter } from "next/navigation";
import { loginRequest } from "@/lib/authConfig";
import {
    intercambiarToken,
    isAutenticado,
    ErrorDeSesion,
} from "@/lib/auth";

export default function Home() {
    const { instance, accounts, inProgress } = useMsal();
    const router = useRouter();

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (inProgress !== InteractionStatus.None) return;

        const cuenta =
            instance.getActiveAccount() ??
            (accounts.length > 0 ? accounts[0] : null);

        if (!cuenta) return;

        instance.setActiveAccount(cuenta);

        if (isAutenticado()) {
            router.replace("/mfpages/home");
            return;
        }

        (async () => {
            setCargando(true);
            setError(null);

            try {
                await intercambiarToken(instance, cuenta);
                router.replace("/mfpages/home");
            } catch (e) {
                setError(
                    e instanceof ErrorDeSesion
                        ? e.message
                        : "No se pudo iniciar sesión."
                );
            } finally {
                setCargando(false);
            }
        })();
    }, [instance, accounts, inProgress, router]);

    const iniciarSesion = () => {
        setError(null);
        instance.loginRedirect(loginRequest);
    };

    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
                Portal de tareas
            </h1>

            {cargando && <p>Autenticando con Microsoft…</p>}

            {!cargando && (
                <button
                    onClick={iniciarSesion}
                    disabled={inProgress !== InteractionStatus.None}
                    style={{
                        padding: "0.75rem 1.5rem",
                        fontSize: "1rem",
                        cursor: "pointer",
                    }}
                >
                    Iniciar sesión con Microsoft
                </button>
            )}

            {error && (
                <p style={{ color: "#b91c1c", maxWidth: "30rem", textAlign: "center" }}>
                    {error}
                </p>
            )}
        </main>
    );
}