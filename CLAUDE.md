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

## Architecture rule — read before adding any page

This is a Hexagonal Architecture (Ports & Adapters), matching the Swift
app's Clean Architecture layering:

```
app/ (driving adapter)  →  lib/application/ (core, use cases)  →
  lib/repositories/*.repository.ts (driven ports)  ←  lib/repositories/supabase/* (driven adapter)
```

- `app/*` (pages/components) imports ONLY from `lib/application/*`. Never
  `lib/repositories/*` or `@supabase/supabase-js` directly.
- `lib/application/*` (the core — mirrors `Application/UseCases`/
  `Application/Services` in TimTracker-Starter) imports ONLY from
  `lib/repositories/*.repository.ts` (the port interfaces). This is
  where business logic/validation belongs.
- Only `lib/repositories/index.ts` (the composition root) is allowed to
  import a concrete adapter (`lib/repositories/supabase/*`). If a custom
  backend replaces Supabase for some domain later, add a new adapter
  (e.g. `lib/repositories/rest/*`) and wire it up ONLY there — `app/*`
  and `lib/application/*` never change.
