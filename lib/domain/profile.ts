// Domain model — Ticket 024 (TimTracker-Starter repo). No native-app
// counterpart to mirror (that ticket's AK explicitly keeps this web-only,
// per 014-windows-version.md's 2026-08-25 update: account/settings
// functionality lives on the website, not in the native apps). No new
// table/migration either — `displayName` is stored directly in
// `auth.users.user_metadata` via `supabase.auth.updateUser({ data })`,
// same "no unnecessary complexity" call already made for the language
// preference (lib/domain/language.ts) and CSV/PDF export.
export interface Profile {
  email: string;
  // null = no display name set (or cleared back to empty/whitespace-only,
  // see normalizeDisplayNameInput below) — the UI falls back to the
  // email's local part in that case, never an empty string.
  displayName: string | null;
  // ISO datetime — `auth.users.created_at`.
  createdAt: string;
}

// The part of an email address before "@" — the fallback identity shown
// wherever a display name would otherwise appear (Ticket 024 AK: "erster
// Teil vor dem @"). Falls back to the full email if for some reason there
// is no "@" (should not happen for a real Supabase user, but keeps this
// total rather than throwing).
export function emailLocalPart(email: string): string {
  const atIndex = email.indexOf("@");
  return atIndex === -1 ? email : email.slice(0, atIndex);
}

// The single source of truth for "what identity string do we show for
// this user" — used by both DashboardNav (always) and SettingsClient (as
// the read fallback is implicit in the input's own empty state). Kept
// here, not duplicated per call site, so the fallback rule only exists in
// one place.
export function displayNameOrFallback(profile: Profile): string {
  return profile.displayName ?? emailLocalPart(profile.email);
}

// Trims the raw text-input value and turns a whitespace-only/empty result
// into `null` (Ticket 024 edge case: "Anzeigename enthält nur
// Leerzeichen -> wie leer behandeln, nicht als 'gesetzt' werten"). This is
// the ONE place that decides what counts as "no display name" so the save
// path (lib/application/auth.ts) and any future caller agree with each
// other and with displayNameOrFallback above.
export function normalizeDisplayNameInput(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  return trimmed.length === 0 ? null : trimmed;
}
