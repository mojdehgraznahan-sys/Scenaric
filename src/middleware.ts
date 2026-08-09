import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup"];
// /api/cron/ has no user session to check (Vercel Cron, not a browser) — its own routes check
// a CRON_SECRET bearer token instead (see src/app/api/cron/indicators-monitor/route.ts).
// Without this carve-out the session redirect below fires first and Vercel just sees a 302.
const PUBLIC_PREFIXES = ["/auth/", "/api/cron/"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie if it's expired — must run before any route logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /onboarding requires a session too — with email confirmation on, that only exists
  // once the user clicks the confirmation link and lands on /auth/callback (public,
  // below), which exchanges the code for a session and redirects here.
  const isPublic =
    PUBLIC_PATHS.includes(request.nextUrl.pathname) || PUBLIC_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|woff|woff2)$).*)"],
};
