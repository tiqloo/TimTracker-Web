// TODO (Ticket 018): via lib/application/auth.ts#requestPasswordReset(repos, email).
// This IS the hosted reset page Ticket 009 (TimTracker-Starter) is
// waiting on — PASSWORD_RESET_URL currently points at a placeholder.
// Wiring this page up closes that gap for the native apps too.
export default function ResetPasswordPage() {
  return <main className="p-8">Reset Password — TODO</main>;
}
