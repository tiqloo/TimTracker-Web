import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { RegisterForm } from "@/components/RegisterForm";
import { RegistrationChoice } from "@/components/RegistrationChoice";

// Server Component wrapper (Ticket 022) — same split/reasoning as
// app/(auth)/login/page.tsx.
//
// Ticket 102: `?email=` pre-fills the email field for a brand-new user
// arriving from a workspace invitation link (app/invite/accept/page.tsx)
// — read here (raw query param, no redirect-style allowlisting needed:
// it only ever pre-fills a text input, never navigates anywhere) and
// handed to the Client Component as a plain initial value.
//
// Ticket 138: the "Für mich" / "Für mein Team" choice screen
// (RegistrationChoice) only replaces the plain form for an ORGANIC visit
// to /register — anyone arriving with an explicit `?email=` (an
// invitation) or `?redirectTo=` (invite flow's own redirect, or any other
// caller that already knows exactly where this registration should lead)
// skips it entirely and gets the exact same single-step RegisterForm as
// before this ticket. Both of those visitors are joining something that
// already exists (a workspace, a specific destination) — asking them to
// additionally pick "personal or company" would be confusing busywork,
// and the ticket's own AK is explicit that the invite/domain-discovery
// flows must stay unblocked by this change.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirectTo?: string }>;
}) {
  const { email, redirectTo } = await searchParams;
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  if (email || redirectTo) {
    return <RegisterForm lang={lang} prefillEmail={email} />;
  }

  return <RegistrationChoice lang={lang} prefillEmail={email} />;
}
