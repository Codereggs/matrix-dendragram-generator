import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Content-Security-Policy",
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-analytics.com https://vercel.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data:;
      connect-src 'self' https://va.vercel-analytics.com https://vercel.com;
      frame-src 'none';
      object-src 'none';
      form-action 'self';
      frame-ancestors 'none';
    `
      .replace(/\s{2,}/g, " ")
      .trim(),
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Configuración para procesar archivos de mayor tamaño
  experimental: {
    serverComponentsExternalPackages: ["exceljs"],
  },

  // Configuración para Python serverless
  rewrites: async () => {
    return [
      {
        source: "/api/python/:path*",
        destination: "/api/python/:path*",
      },
    ];
  },
};

export default nextConfig;
