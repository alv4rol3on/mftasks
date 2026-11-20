"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useRouter } from "next/navigation";
import { loginRequest } from "@/lib/authConfig";
import {
    intercambiarToken,
    sesionActiva,
    limpiarSesionLocal,
    ErrorDeSesion,
} from "@/lib/auth";
import {
    limpiarSsoRequiereInteraccion,
    marcarSsoRequiereInteraccion,
    ssoRequiereInteraccion,
} from "@/lib/persistencia";
import { aplicarTema } from "@/lib/tema";
import Spinner from "@/components/ui/Spinner";
import styles from "./Login.module.css";

const suscribirSesion = () => () => {};

export default function Home() {
    const { instance, accounts, inProgress } = useMsal();
    const router = useRouter();

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const verificandoSesion = useSyncExternalStore(
        suscribirSesion,
        sesionActiva,
        () => false
    );

    useEffect(() => {
        document.title = "Iniciar sesión · MF Tasks";
        // El login conserva siempre su apariencia original, incluso cuando
        // se llega por navegación cliente desde una ruta en modo oscuro.
        aplicarTema("light");
    }, []);

    // Si ya existe una sesión vigente, nunca se muestra el login ni se
    // permite iniciar sesión de nuevo hasta que el usuario cierre sesión.
    useEffect(() => {
        if (verificandoSesion) {
            router.replace("/mfpages/perfil");
            return;
        }

        // Si había tokens pero ya no son válidos, no reutilizar la cuenta
        // MSAL del usuario anterior sin interacción.
        if (
            localStorage.getItem("access") ||
            localStorage.getItem("refresh")
        ) {
            marcarSsoRequiereInteraccion();
        }

        limpiarSesionLocal();
    }, [router, verificandoSesion]);

    useEffect(() => {
        if (verificandoSesion) return;
        if (inProgress !== InteractionStatus.None) return;

        // Tras un logout o una sesión expirada, exigir un clic explícito
        // para no reautenticar automáticamente al usuario anterior.
        if (ssoRequiereInteraccion()) return;

        const cuenta =
            instance.getActiveAccount() ??
            (accounts.length === 1 ? accounts[0] : null);

        // Con varias cuentas en caché no se elige una automáticamente:
        // en un equipo compartido podría iniciar sesión el usuario anterior.
        if (!cuenta) return;

        instance.setActiveAccount(cuenta);

        if (sesionActiva()) {
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
    }, [instance, accounts, inProgress, router, verificandoSesion]);

    const iniciarSesion = (otroCorreo = false) => {
        if (sesionActiva()) {
            router.replace("/mfpages/perfil");
            return;
        }

        if (inProgress !== InteractionStatus.None) return;

        setError(null);
        limpiarSsoRequiereInteraccion();
        if (otroCorreo) instance.setActiveAccount(null);
        instance.loginRedirect(
            otroCorreo
                ? { ...loginRequest, prompt: "select_account" }
                : loginRequest
        );
    };

    const autenticando =
        verificandoSesion || cargando || inProgress !== InteractionStatus.None;

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
                            {verificandoSesion
                                ? "Verificando sesión…"
                                : cargando
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