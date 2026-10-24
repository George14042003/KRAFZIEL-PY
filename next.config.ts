import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.BACKEND_PROXY_ORIGIN ?? "http://127.0.0.1:8006";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: `${BACKEND_ORIGIN}/auth/:path*` },
      { source: "/candidates/:path*", destination: `${BACKEND_ORIGIN}/candidates/:path*` },
      { source: "/interviews/:path*", destination: `${BACKEND_ORIGIN}/interviews/:path*` },
      { source: "/offers/:path*", destination: `${BACKEND_ORIGIN}/offers/:path*` },
      { source: "/jobs/:path*", destination: `${BACKEND_ORIGIN}/jobs/:path*` },
      { source: "/job-applications/:path*", destination: `${BACKEND_ORIGIN}/job-applications/:path*` },
      { source: "/me/:path*", destination: `${BACKEND_ORIGIN}/me/:path*` },
      { source: "/admin/:path*", destination: `${BACKEND_ORIGIN}/admin/:path*` },
      { source: "/public/:path*", destination: `${BACKEND_ORIGIN}/public/:path*` },
      { source: "/ws/:path*", destination: `${BACKEND_ORIGIN}/ws/:path*` },
      { source: "/turn-credentials", destination: `${BACKEND_ORIGIN}/turn-credentials` },
      { source: "/media/:path*", destination: `${BACKEND_ORIGIN}/media/:path*` },
      { source: "/health", destination: `${BACKEND_ORIGIN}/health` },
    ];
  },
};

export default nextConfig;
