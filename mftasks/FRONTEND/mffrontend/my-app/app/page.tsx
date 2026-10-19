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
import Spinner from "@/components/ui/Spinner";
import styles from "./Login.module.css";

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
            router.replace("/mfpages/perfil");
            return;
        }

        (async () => {
            setCargando(true);
            setError(null);

            try {
                await intercambiarToken(instance, cuenta);
                router.replace("/mfpages/perfil");
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

    const iniciarSesion = (otroCorreo = false) => {
        setError(null);
        if (otroCorreo) instance.setActiveAccount(null);
        instance.loginRedirect(
            otroCorreo
                ? { ...loginRequest, prompt: "select_account" }
                : loginRequest
        );
    };

    const autenticando =
        cargando || inProgress !== InteractionStatus.None;

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <img src="/mfsac.png" alt="MF SAC" className={styles.logo} />

                <p className={styles.eyebrow}>MF Tasks</p>
                <h1 className={styles.title}>Portal de tareas</h1>

                {autenticando ? (
                    <p className={styles.status} role="status" aria-live="polite">
                        <Spinner size={18} />
                        <span>
                            {cargando
                                ? "Autenticando con Microsoft…"
                                : "Conectando con Microsoft…"}
                        </span>
                    </p>
                ) : (
                    <button
                        type="button"
                        onClick={() => iniciarSesion()}
                        className={styles.primary}
                    >
                        Iniciar sesión con Microsoft
                    </button>
                )}

                {error && (
                    <button
                        type="button"
                        onClick={() => iniciarSesion(true)}
                        disabled={inProgress !== InteractionStatus.None}
                        className={styles.secondary}
                    >
                        Iniciar sesión con otro correo
                    </button>
                )}

                {error && <p className={styles.error}>{error}</p>}
            </section>
        </main>
    );
}