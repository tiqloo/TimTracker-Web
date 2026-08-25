// TODO (Ticket 018): via lib/application/auth.ts#register(repos, email, password).
// A 7-day trial starts server-side automatically on signup (same DB
// trigger used by the native apps, see
// supabase/migrations/0003_trial.sql in TimTracker-Starter).
export default function RegisterPage() {
  return <main className="p-8">Register — TODO</main>;
}
