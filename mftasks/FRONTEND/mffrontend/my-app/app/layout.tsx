import "./globals.css";
import AuthProvider from "./providers/MsalProviders";
import { ToastProvider } from "@/components/ui/Toast";
import VmErrorFilter from "@/components/ui/VmErrorFilter";
import { TasksWebSocketProvider } from "./providers/TasksWebSocketProvider";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata = {
    title: "MF Tasks",
    description: "Sistema de solicitudes y tareas MF",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }}
                />
            </head>
            <body>
                <VmErrorFilter />

                <AuthProvider>
                    <ToastProvider>
                        <TasksWebSocketProvider>
                            {children}
                        </TasksWebSocketProvider>
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}