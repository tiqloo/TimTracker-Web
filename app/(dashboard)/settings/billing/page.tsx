// TODO (Ticket 018): "Abo verwalten" via
//   const { subscription } = await getServerRepositories();
//   const url = await subscription.openBillingPortal();
// which calls the SAME create-portal-session Edge Function already
// deployed for Ticket 007 — no new backend endpoint needed.
export default function BillingSettingsPage() {
  return <main className="p-8">Abo verwalten — TODO</main>;
}
