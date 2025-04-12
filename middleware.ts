import { NextResponse } from "next/server";

/**
 * Middleware para agregar cabeceras de seguridad
 */
export async function middleware() {
  // Obtener la respuesta original
  const response = NextResponse.next();

  // Agregar cabeceras de seguridad
  // Content-Security-Policy - Proporciona una capa adicional de seguridad
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-analytics.com https://va.vercel-scripts.com ${process.env.API_URL}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://va.vercel-analytics.com https://va.vercel-scripts.com ${process.env.API_URL};`
  );

  // X-Content-Type-Options - Evita MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // X-Frame-Options - Previene clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // X-XSS-Protection - Filtro XSS en navegadores antiguos
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Strict-Transport-Security - Fuerza HTTPS
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Referrer-Policy - Controla información del referente
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy - Restringe características del navegador
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

/**
 * Configurar en qué rutas se ejecutará el middleware
 */
export const config = {
  matcher: [
    // Excluir archivos estáticos, favicons, etc.
    "/((?!_next/image|_next/static|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
