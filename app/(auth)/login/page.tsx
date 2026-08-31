import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { LoginForm } from "@/components/LoginForm";

// Server Component wrapper (Ticket 022): resolves the effective UI
// language server-side, same getEffectiveLanguageCode() pattern every
// (dashboard)/* page uses, then hands it to the actual interactive form
// (components/LoginForm.tsx, a Client Component — needs
// useSearchParams()/router/onAuthStateChange, none of which are
// available here). No auth/session check of its own: this route is
// reachable precisely because the visitor is signed out.
export default async function LoginPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  return <LoginForm lang={lang} />;
}
