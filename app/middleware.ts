import { NextResponse } from "next/server";

export function middleware() {
  // Clonar la respuesta actual
  const response = NextResponse.next();

  // Definir las políticas de seguridad
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self' https://va.vercel-analytics.com https://va.vercel-scripts.com ${
      process.env.NEXT_PUBLIC_API_URL || "*"
    };
    frame-src 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Agregar cabeceras de seguridad
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

// Ver: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
