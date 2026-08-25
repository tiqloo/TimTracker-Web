// Driven port for identity/auth — the real gap flagged in the 2026-08-25
// structure review: (auth)/* pages had no port to call, only the
// composition root's data repositories existed. Kept intentionally
// function-shaped (not a class/command hierarchy) — this app is small
// enough that a plain interface is sufficient, per the same review's own
// point 4 about not over-engineering inbound ports.
export interface AuthRepository {
  register(email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
}
