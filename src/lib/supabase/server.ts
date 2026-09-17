import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { config } from "@/lib/config";

/**
 * Supabase client for Server Components / Route Handlers, bound to Next.js
 * cookies. Runs as the anon key + whatever session cookie the browser sent —
 * RLS applies normally (auth.uid() resolves to the logged-in Telegram user).
 *
 * No generated `Database` generic type: this project has no linked Supabase
 * project to run `supabase gen types` against in this environment. Row shapes
 * used by the app are instead hand-typed in src/lib/matching/types.ts and the
 * form schemas in src/lib/validation/. Regenerate and wire up real types once
 * a project is linked (see README "Type generation").
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(config.supabaseUrl(), config.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; middleware.ts refreshes the
          // session cookie instead. Safe to ignore here.
        }
      },
    },
  });
}
