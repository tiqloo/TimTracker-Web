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
  lib/repositories/repositories.ts (pure port aggregate)  ←  lib/composition-root.ts (wires adapters to ports)
```

- `app/*` (pages/components) imports ONLY from `lib/application/*`. Never
  `lib/repositories/*`, `lib/composition-root.ts`, or
  `@supabase/supabase-js` directly.
- `lib/application/*` (the core — mirrors `Application/UseCases`/
  `Application/Services` in TimTracker-Starter) imports ONLY the
  `Repositories` type from `lib/repositories/repositories.ts` (the pure
  port aggregate, no adapter imports). Never `lib/composition-root.ts` or
  any `lib/repositories/supabase/*` adapter directly. This is where
  business logic/validation belongs — plus real domain rules that live in
  `lib/domain/*` itself (e.g. `canUseApp()` in `lib/domain/subscription.ts`).
- `lib/domain/*` (renamed from `lib/types/` on 2026-08-25 — a structure
  review correctly pointed out "types" undersells that these are fachliche
  Domain-Modelle, not generic TS helper types) holds domain models AND
  real business rules, not just interfaces. `canUseApp()` mirrors the RLS
  policy condition verbatim — keep both in sync if it ever changes.
- Only `lib/composition-root.ts` is allowed to import a concrete adapter
  (`lib/repositories/supabase/*`). It lives OUTSIDE `lib/repositories/`
  on purpose — a composition root isn't itself a port/repository. If a
  custom backend replaces Supabase for some domain later, add a new
  adapter (e.g. `lib/repositories/rest/*`) and wire it up ONLY there —
  `app/*` and `lib/application/*` never change.
- All of the above is enforced by `eslint.config.mjs`
  (`no-restricted-imports`), not just documented here. Watch out when
  adding new rules: a bare import like `"@/lib/composition-root"` needs
  an exact `paths` entry (glob `patterns` don't match a path with nothing
  after the last segment), and a relative import like
  `"./supabase/..."` needs a broad pattern like `"**/supabase/**"` (a
  pattern anchored on `lib/repositories/supabase/**` won't match a
  relative specifier that never contains that literal substring). Both
  gaps were found by deliberately reintroducing the exact violation and
  confirming `eslint` failed — do the same before trusting a new rule.

## Resolved 2026-08-25: pages need Repositories, but can't import the composition root

Implementing Ticket 018's auth pages (`(auth)/login`, `/register`,
`/reset-password`) surfaced the gap the skeleton phase only gestured at:
every `lib/application/*` function takes `repos: Repositories` as its
first argument, but `app/*` isn't allowed to import `lib/repositories/*`
or `lib/composition-root.ts` to build one itself.

**Resolution:** two thin, designated files inside `lib/application/`
(so they stay importable from `app/*`) whose only job is handing back a
`Repositories` instance — zero business logic:
- `lib/application/client.ts` — `"use client"`, wraps
  `getBrowserRepositories()`.
- `lib/application/server.ts` — async, wraps `getServerRepositories()`.

`eslint.config.mjs` encodes this as a structural exception, not just a
comment: the general `lib/application/**` rule (no composition-root
import) explicitly `ignores` these two files, and a separate, narrower
rule block applies to just them — it allows `@/lib/composition-root*`
but still blocks `@supabase/supabase-js` and `lib/repositories/supabase/*`
directly, so they can reach the composition root but not bypass it.
Verified by deliberately reintroducing violations in both directions
(composition-root import in a random `lib/application/*` file — still
fails; `@supabase/supabase-js` import inside `client.ts` itself — still
fails) and confirming `eslint` catches both, same testing discipline as
the rest of this file's boundary rules.

**Second-order finding from testing this for real:** the original single
`lib/composition-root.ts` statically imported BOTH the browser and server
Supabase clients. The moment `lib/application/client.ts` (a `"use
client"` module) imported it, `npm run build` broke for real — Next.js
refuses to bundle `lib/supabase/server.ts` (which uses `next/headers`,
Server-Components-only) into any client-reachable module graph, even
though the server branch is never called from client code. Fixed by
splitting into `lib/composition-root.client.ts` /
`lib/composition-root.server.ts`, one per Next.js runtime target;
`lib/composition-root.ts` itself now only re-exports the `Repositories`
type, kept so that path doesn't dangle. This is exactly the kind of
gap a skeleton-only phase can't surface — worth remembering if a
similar "single file importing two runtime-incompatible dependencies"
pattern shows up elsewhere later (e.g. if `lib/application/server.ts`
itself ever needs a browser-only dependency, don't reintroduce the same
mistake there).

Full reasoning also documented in `README.md`'s architecture section
(kept in sync — read that version if you want the German-language
structure-diagram context) and in
`TimTracker-Starter/docs/tickets/018-account-website.md`.

## Deferred from the 2026-08-25 structure review (reasoning, not just a list)

- **`repositories/` → `ports/out/` rename**: reasonable once a
  non-repository port exists (PaymentProvider, EmailSender, ...) — today
  all four ports genuinely are repositories, renaming now would be
  premature.
- **Explicit inbound-port interfaces + service classes**: the review
  itself said not to force this for a project this size; plain async
  functions in `lib/application/*` are enough.
- **`app/api/webhooks/stripe/route.ts` in this repo**: rejected. Stripe
  webhooks are already correctly owned by the `stripe-webhook` Supabase
  Edge Function (`TimTracker-Starter/supabase/functions/stripe-webhook`,
  battle-tested — it already caught and fixed a real Stripe API breaking
  change). A second webhook receiver here would be a competing source of
  truth, not an improvement.
- **Restructuring `app/` to drop Heute/Historie/Projekte and only keep
  Account/Billing**: rejected. Contradicts the explicit PO decision
  (`TimTracker-Starter/docs/tickets/014-windows-version.md`, 2026-08-25
  update) that this site should reach full Dashboard parity so those
  views can eventually be removed from the native apps — the opposite of
  what that review point assumed.
