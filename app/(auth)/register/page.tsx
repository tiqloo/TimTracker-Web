import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { RegisterForm } from "@/components/RegisterForm";

// Server Component wrapper (Ticket 022) — same split/reasoning as
// app/(auth)/login/page.tsx.
export default async function RegisterPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  return <RegisterForm lang={lang} />;
}
