import type { NextConfig } from "next";

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  skipTrailingSlashRedirect: true,
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
    ];
  },
};

export default nextConfig;
