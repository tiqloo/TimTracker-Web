import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Only the publishable/anon key is ever used
// here — the secret key must never appear in client code, matching the
// same rule enforced in the TimTracker-Starter (macOS/Windows) repo.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
