"use client";

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/authConfig";

export default function Home() {
    const { instance } = useMsal();

    const iniciarSesion = () => {
        instance.loginRedirect(loginRequest);
    };

    return (
        <main>
            <button onClick={iniciarSesion}>
                Iniciar sesión con Microsoft
            </button>
        </main>
    );
}