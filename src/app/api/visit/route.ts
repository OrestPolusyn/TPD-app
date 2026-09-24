import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { madridDate } from "@/lib/stats";
import { isBot, normalizePath, visitorHash } from "@/lib/visits";

/**
 * Records one anonymous page view (see supabase/migrations/0027).
 *
 * Always answers 204, whatever happens: this is fire-and-forget from
 * navigator.sendBeacon, nothing reads the response, and a counter must never
 * surface an error on somebody's screen.
 */
export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get("user-agent") ?? "";
    if (isBot(userAgent)) return new NextResponse(null, { status: 204 });

    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return new NextResponse(null, { status: 204 });
    }
    const path = normalizePath((body as { path?: unknown })?.path);
    if (!path) return new NextResponse(null, { status: 204 });

    // The owner opening their own site all day would drown the real numbers.
    // Only looked up when a session cookie is present, so anonymous visitors
    // cost no auth round-trip.
    if (request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (me?.role === "moderator") return new NextResponse(null, { status: 204 });
      }
    }

    const key = process.env.VISIT_HASH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return new NextResponse(null, { status: 204 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
    const day = madridDate(new Date());

    const { error } = await createAdminClient()
      .from("page_views")
      .insert({ day, path, visitor: visitorHash(key, day, ip, userAgent) });
    if (error) console.error("page view not recorded:", error.message);
  } catch (err) {
    console.error("page view not recorded:", err);
  }
  return new NextResponse(null, { status: 204 });
}
