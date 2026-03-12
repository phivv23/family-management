import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieMode = "action" | "component";

async function createSupabaseServerClientInternal(mode: CookieMode): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const cookieStore = await cookies();
  const allowSet = mode === "action";
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        if (!allowSet) return;
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      }
    }
  });
}

// For Server Actions / Route Handlers (cookies can be mutated)
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  return createSupabaseServerClientInternal("action");
}

// For Server Components (cookies are read-only)
export async function createSupabaseServerComponentClient(): Promise<SupabaseClient> {
  return createSupabaseServerClientInternal("component");
}
