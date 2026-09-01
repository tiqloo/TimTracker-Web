import { getRepositories } from "@/lib/application/server";
import { getFullDataExport } from "@/lib/application/data-export";

// GDPR/DSGVO Art. 20 "Datenübertragbarkeit" full data export (Ticket 046,
// TimTracker-Starter repo) — the complementary right to
// deleteAccount()/DeleteAccountSection's Art. 17 "Recht auf Löschung"
// (lib/application/auth.ts). A single JSON download of everything this
// app's own Supabase schema holds about the current user (profile, every
// project incl. archived, every time entry ever recorded, current
// subscription status) — see lib/application/data-export.ts's own
// comment for exactly what's gathered and why, and that ticket for what's
// deliberately out of scope (Stripe raw data, scheduled exports, import).
//
// Deliberately NO canUseApp() gate — same reasoning already applied to
// DeleteAccountSection and the billing/upgrade action (Ticket 011): a
// GDPR right must stay reachable even without an active trial/
// subscription, it cannot depend on one. Auth itself is enforced the
// same way as every other "/dashboard/*" route, including the sibling
// CSV/PDF export routes (../pdf/route.ts, ../../export/route.ts): by
// proxy.ts's session check (Supabase getUser(), not getSession() — see
// that file's own comment for why), which redirects an unauthenticated
// request to /login before this handler ever runs. RLS on every table
// behind each repository port then further ensures a signed-in user only
// ever gets rows scoped to their own auth.uid() — the same two-layer
// protection every other dashboard route/export already relies on, no
// separate check needed here.
//
// Server-rendered, single Route Handler, no client-side assembly from
// multiple API calls — matches the ticket's own AK and the PDF export's
// precedent (Ticket 021).
export async function GET() {
  const repos = await getRepositories();
  const data = await getFullDataExport(repos);

  const json = JSON.stringify(data, null, 2);
  const filenameDate = data.exportedAt.slice(0, 10);

  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="TimTracker-Datenexport-${filenameDate}.json"`,
    },
  });
}
