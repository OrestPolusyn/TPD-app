import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Adapted from the standard @supabase/ssr middleware pattern for Next.js 16's
// renamed "proxy" file convention (was middleware.ts before v16):
// refreshes the auth token cookie on every request so Server Components
// always see a valid (non-expired) session.
// https://supabase.com/docs/guides/auth/server-side/nextjs
export async function proxy(request: NextRequest) {
  // Legacy shape from the old two-step /locations picker, whose step-2 form
  // submitted ?province=…&office=<id>. Handled here rather than in the page so
  // it stays a real 307: /locations now has a loading.tsx, so a redirect() in
  // the page happens after the fallback has already streamed with a 200.
  if (request.nextUrl.pathname === "/locations") {
    const office = request.nextUrl.searchParams.get("office");
    if (office) {
      return NextResponse.redirect(new URL(`/locations/${encodeURIComponent(office)}`, request.url));
    }
  }

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
