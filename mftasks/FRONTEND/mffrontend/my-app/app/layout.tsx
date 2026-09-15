import "./globals.css";
import AuthProvider from "./providers/MsalProviders";
import { ToastProvider } from "@/components/ui/Toast";
import VmErrorFilter from "@/components/ui/VmErrorFilter";
import { TasksWebSocketProvider } from "./providers/TasksWebSocketProvider";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
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