import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Allow inline scripts and eval for Next.js and Casper Wallet extension
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // Allow connections to Casper RPC nodes
    "connect-src 'self' https://*.casper.network https://*.casperlabs.io",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
};

export function middleware(_request: NextRequest) {
  void _request;
  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set("X-Request-Id", crypto.randomUUID());
  response.headers.set("X-Served-At", new Date().toISOString());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
