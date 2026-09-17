import type { NextConfig } from "next";

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  skipTrailingSlashRedirect: true,
  experimental: {
    // El upload pasa por el proxy de Next; el default (10MB) truncaría archivos
    // cercanos al límite de 10MB más el overhead multipart.
    proxyClientMaxBodySize: "25mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*/",
        destination: `${backendInternalUrl}/api/:path*/`,
      },
      {
        source: "/ws/:path*/",
        destination: `${backendInternalUrl}/ws/:path*/`,
      },
      {
        // Adjuntos: /media/tareas/<archivo> (sin slash final) -> backend.
        source: "/media/:path*",
        destination: `${backendInternalUrl}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
