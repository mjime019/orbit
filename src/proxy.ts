import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// (Next 16 "proxy" convention — formerly middleware.)
// Every page and API route requires a logged-in session (the family).
// Canonical @supabase/ssr pattern: refresh the session cookie on each
// request, redirect unauthenticated pages to /login, 401 unauthenticated APIs.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() (validated against the auth server), not getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (request.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Everything except /login and static assets.
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
