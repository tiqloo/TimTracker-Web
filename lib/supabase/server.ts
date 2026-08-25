import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for Server Components/Route Handlers.
// Still only the publishable/anon key — RLS on the existing tables
// (projects, time_entries, subscriptions) enforces per-user access,
// exactly as it already does for the native macOS/Windows clients.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component without a following
            // response write — safe to ignore if middleware refreshes
            // the session, per @supabase/ssr's documented pattern.
          }
        },
      },
    },
  );
}
