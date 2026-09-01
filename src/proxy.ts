import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/seo/site";

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && shouldRedirectToCanonicalOrigin(request)) {
    const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, SITE_URL);
    return NextResponse.redirect(destination, 308);
  }

  let response = NextResponse.next({ request });
  const noindexSearchVariant = shouldNoindexSearchVariant(request);
  const noindexPrivateRoute = shouldNoindexPrivateRoute(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    if (noindexSearchVariant || noindexPrivateRoute) setNoindexHeader(response);
    return response;
  }

  const supabase = createServerClient(url, publishableKey, {
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

  await supabase.auth.getClaims();
  if (noindexSearchVariant || noindexPrivateRoute) setNoindexHeader(response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

function shouldRedirectToCanonicalOrigin(request: NextRequest): boolean {
  const canonical = new URL(SITE_URL);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(":", "");
  return host !== canonical.host || protocol !== canonical.protocol.replace(":", "");
}

function shouldNoindexSearchVariant(request: NextRequest): boolean {
  if (request.nextUrl.pathname === "/search" || request.nextUrl.pathname.startsWith("/search/")) return true;
  // Every parameterized URL is a non-indexable variant. This includes
  // filters/sorts and attribution parameters (which can still be measured;
  // they should not create duplicate crawlable URLs).
  return request.nextUrl.searchParams.size > 0;
}

function shouldNoindexPrivateRoute(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return [
    "/admin",
    "/api",
    "/auth",
    "/checkout",
    "/create",
    "/dashboard",
    "/library",
    "/login",
    "/preview",
    "/register",
    "/store-images",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function setNoindexHeader(response: NextResponse): void {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  // Do not let a CDN reuse a canonical/public cache entry for a private route
  // or a query-string variant. Attribution parameters remain measurable by
  // the app, but their response must never be shared or cached as indexable.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
}
