// TODO (Ticket 018): "Abo verwalten" via
// lib/application/billing.ts#manageSubscription(repos), which internally
// calls the SAME create-portal-session Edge Function already deployed
// for Ticket 007. Pages call lib/application/*, never lib/repositories/*
// directly.
export default function BillingSettingsPage() {
  return <main className="p-8">Abo verwalten — TODO</main>;
}
