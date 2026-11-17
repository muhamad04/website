import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";

const PROTECTED_PREFIXES = [
  "/teacher",
  "/student",
  "/account-pending",
  "/account-disabled",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectWithRefreshedCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
): NextResponse {
  const redirectResponse = NextResponse.redirect(
    new URL(pathname, request.url),
  );

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

/**
 * Refreshes the Supabase session cookie and performs optimistic route checks.
 * Real authorization happens again in the server data-access layer.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabasePublicConfig();

  if (!config) {
    return response;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && isProtectedPath(pathname)) {
    return redirectWithRefreshedCookies(request, response, "/login");
  }

  if (user && pathname === "/login") {
    return redirectWithRefreshedCookies(request, response, "/");
  }

  return response;
}
