import { getRepositories } from "@/lib/application/server";
import { getFullDataExport } from "@/lib/application/data-export";
import { requireUser } from "@/lib/application/auth";
import { routeErrorResponse } from "@/lib/http/route-error";

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
// subscription, it cannot depend on one. The handler revalidates the user
// directly; proxy.ts remains the UX guard and table RLS remains the final
// per-row boundary.
//
// Server-rendered, single Route Handler, no client-side assembly from
// multiple API calls — matches the ticket's own AK and the PDF export's
// precedent (Ticket 021).
export async function GET() {
  try {
    return await createDataExportResponse();
  } catch (error) {
    return routeErrorResponse(error, "full_data_export");
  }
}

async function createDataExportResponse(): Promise<Response> {
  const repos = await getRepositories();
  await requireUser(repos);
  const data = await getFullDataExport(repos);

  const json = JSON.stringify(data, null, 2);
  const filenameDate = data.exportedAt.slice(0, 10);

  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="Tiqloo-Datenexport-${filenameDate}.json"`,
    },
  });
}
