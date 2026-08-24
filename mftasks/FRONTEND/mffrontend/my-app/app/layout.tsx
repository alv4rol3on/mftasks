import "./globals.css";
import AuthProvider from "./providers/MsalProviders";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body>
                <AuthProvider>
                    <ToastProvider>{children}</ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}