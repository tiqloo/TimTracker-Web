@AGENTS.md

# TimTracker Web — project context

This is the account/dashboard website for TimTracker, meant to eventually
reach full feature parity with the native macOS/Windows apps' Dashboard,
Historie, Statistiken, Einstellungen, and Projekt-Verwaltung (see
[Ticket 018](../TimTracker-Starter/docs/tickets/018-account-website.md) in
the `TimTracker-Starter` repo for the full spec) — at which point those
views can be removed from the native apps (see that repo's Ticket 014).

## Read first, every session
1. `TimTracker-Starter/docs/tickets/018-account-website.md` — this repo's
   spec and current status
2. `TimTracker-Starter/docs/tickets/README.md` — the full backlog; tickets
   for this repo live there too, not in a separate system here
3. `TimTracker-Starter/CLAUDE.md` and `README.md` — shared collaboration
   rules (tests before push, own branch, no secrets in repo/chat,
   additive-only migrations) apply here identically

## Key facts
- Same Supabase project as the native apps — same tables, same RLS, same
  Auth users. Never duplicate migrations/RLS here; they live in
  `TimTracker-Starter/supabase/`.
- Only `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  belong in this repo's env — never the Supabase secret key.
- `app/(dashboard)/settings/billing/` should call the already-deployed
  `create-portal-session` Edge Function (built for Ticket 007) — no new
  backend needed for that specific feature.
- `app/(auth)/reset-password/` is also the missing hosted page Ticket 009
  (password reset, native apps) is waiting on.
