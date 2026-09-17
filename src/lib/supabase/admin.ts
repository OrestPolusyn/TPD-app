import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER-ONLY: bypasses RLS entirely.
 *
 * Only ever import this from a Route Handler (src/app/api/**\/route.ts) or a
 * script run with Node directly (scripts/seed.ts). Never import it from a
 * "use client" file or anything that could end up in a client bundle. The
 * `typeof window` check below is a defense-in-depth backstop, not the only
 * line of defense: SUPABASE_SERVICE_ROLE_KEY is never prefixed with
 * NEXT_PUBLIC_, so Next.js would not inline it into a client bundle even if
 * this function were mistakenly called from client code — it would just be
 * `undefined` there and fail the check below.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from client code.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
