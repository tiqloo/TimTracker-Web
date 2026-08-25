// TODO (Ticket 018): via lib/application/auth.ts#login(repos, email, password).
// Pages call lib/application/*, never lib/repositories/* or Supabase directly.
export default function LoginPage() {
  return <main className="p-8">Login — TODO</main>;
}
