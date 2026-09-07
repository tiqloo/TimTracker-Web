import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { RegisterForm } from "@/components/RegisterForm";

// Server Component wrapper (Ticket 022) — same split/reasoning as
// app/(auth)/login/page.tsx.
//
// Ticket 102: `?email=` pre-fills the email field for a brand-new user
// arriving from a workspace invitation link (app/invite/accept/page.tsx)
// — read here (raw query param, no redirect-style allowlisting needed:
// it only ever pre-fills a text input, never navigates anywhere) and
// handed to the Client Component as a plain initial value.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  return <RegisterForm lang={lang} prefillEmail={email} />;
}
