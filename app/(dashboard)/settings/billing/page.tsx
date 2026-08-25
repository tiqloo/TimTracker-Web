export default function BillingSettingsPage() {
  // TODO (Ticket 018): "Abo verwalten" — calls the SAME create-portal-session
  // Edge Function already deployed for Ticket 007 (see
  // supabase/functions/create-portal-session/index.ts in
  // TimTracker-Starter). No new backend work needed for this specific
  // button, just call it from here too.
  return <main className="p-8">Abo verwalten — TODO</main>;
}
