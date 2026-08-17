"use client";

import { useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/lib/authConfig";

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [msalInstance, setMsalInstance] =
        useState<PublicClientApplication | null>(null);

    useEffect(() => {
        const initializeMsal = async () => {
            const instance = new PublicClientApplication(msalConfig);

            await instance.initialize();

            setMsalInstance(instance);
        };

        initializeMsal();
    }, []);

    if (!msalInstance) {
        return null;
    }

    return (
        <MsalProvider instance={msalInstance}>
            {children}
        </MsalProvider>
    );
}