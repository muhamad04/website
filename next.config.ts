import type { NextConfig } from "next";

/**
 * Security headers are generated here so they apply to every route, including
 * route handlers and error pages. The CSP is intentionally explicit: the app
 * only needs its own origin, Supabase (REST, Auth and private Storage),
 * YouTube's privacy-enhanced player and YouTube thumbnails.
 */

const SUPABASE_WILDCARD_HTTPS = "https://*.supabase.co";

/** Exact Supabase origins from configuration, plus the project wildcard. */
function supabaseOrigins(isProduction: boolean): {
  http: string[];
  websocket: string[];
} {
  const http = new Set<string>([SUPABASE_WILDCARD_HTTPS]);
  const websocket = new Set<string>(["wss://*.supabase.co"]);
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      http.add(url.origin);
      websocket.add(
        `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`,
      );
    } catch {
      // Fall back to the wildcard above; the build should not fail on a bad
      // optional public URL.
    }
  }

  if (!isProduction) {
    http.add("http://localhost:*");
    http.add("http://127.0.0.1:*");
    websocket.add("ws://localhost:*");
    websocket.add("ws://127.0.0.1:*");
  }

  return { http: [...http], websocket: [...websocket] };
}

function contentSecurityPolicy(isProduction: boolean): string {
  const supabase = supabaseOrigins(isProduction);
  const storageAndApi = supabase.http.join(" ");
  const directives = [
    "default-src 'self'",
    // Next.js injects inline bootstrap scripts. A nonce-based CSP would need a
    // proxy rewrite on every response; 'unsafe-inline' is the compatible
    // baseline. 'unsafe-eval' is development-only for the dev overlay.
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${storageAndApi} https://i.ytimg.com https://img.youtube.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${storageAndApi} ${supabase.websocket.join(" ")}`,
    // PDF resources are embedded from private Supabase Storage. YouTube uses
    // the privacy-enhanced nocookie player only.
    `frame-src 'self' ${storageAndApi} https://www.youtube-nocookie.com`,
    `media-src 'self' blob: ${storageAndApi}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (isProduction) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function securityHeaders(isProduction: boolean): Array<{
  key: string;
  value: string;
}> {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(isProduction),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    // frame-ancestors above is the modern control; this covers older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  // Cache Components stays disabled: every protected page reads the session
  // at request time, so there is no static shell to cache.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
};

export default nextConfig;
