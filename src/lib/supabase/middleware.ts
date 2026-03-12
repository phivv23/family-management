import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico", "/assets", "/public"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const response = NextResponse.next();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const hasSession = Boolean(session);

  const isLoginOrRegister = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isJoinPage = pathname.startsWith("/join/");

  if (!hasSession && !isLoginOrRegister && !isOnboarding && !isJoinPage) {
    const u = request.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(u);
  }

  if (hasSession && isLoginOrRegister) {
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam?.startsWith("/")) {
      return NextResponse.redirect(new URL(nextParam, request.url));
    }
    const u = request.nextUrl.clone();
    u.pathname = "/dashboard";
    u.search = "";
    return NextResponse.redirect(u);
  }

  if (!hasSession && isOnboarding) {
    const u = request.nextUrl.clone();
    u.pathname = "/login";
    u.searchParams.set("next", "/onboarding");
    return NextResponse.redirect(u);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(request: NextRequest) {
  return updateSession(request);
}
