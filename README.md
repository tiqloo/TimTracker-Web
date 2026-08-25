# TimTracker Web

Account-Verwaltung & Dashboard für TimTracker im Browser — siehe
[Ticket 018](../TimTracker-Starter/docs/tickets/018-account-website.md)
im Haupt-Repo (`TimTracker-Starter`) für die vollständige Spezifikation.

## Beziehung zum Haupt-Repo

Dieses Repo ist bewusst getrennt von `TimTracker-Starter` (andere
Tech-Stack, andere Deploy-Pipeline), teilt sich aber **dasselbe
Supabase-Projekt** — gleiche Tabellen (`projects`, `time_entries`,
`subscriptions`), gleiche RLS-Policies, gleicher Auth-Nutzerpool. Ein
Login funktioniert mit demselben Account wie in der Mac-/Windows-App.

- Migrationen, RLS-Policies, Edge Functions: bleiben in
  `TimTracker-Starter/supabase/` die eine Quelle der Wahrheit — hier
  nicht duplizieren
- Tickets/Backlog: bleiben zentral in
  `TimTracker-Starter/docs/tickets/` — auch für dieses Repo, kein
  eigenes Ticket-System hier

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- `@supabase/supabase-js` + `@supabase/ssr` — kein eigenes Backend, RLS
  aus dem Haupt-Repo gilt identisch
- Hosting: Vercel

## Struktur

```
app/
  (auth)/
    login/
    register/
    reset-password/     # schließt auch die offene Lücke aus Ticket 009
                         # (Passwort-Reset) im Haupt-Repo — PASSWORD_RESET_URL
                         # zeigt dorthin, sobald diese Seite fertig ist
  (dashboard)/
    page.tsx             # "Heute"
    history/
    projects/             # volle CRUD, nicht nur ansehen
    settings/
      billing/            # "Abo verwalten" — ruft dieselbe
                           # create-portal-session Edge Function auf,
                           # die für Ticket 007 bereits existiert
lib/
  supabase/
    client.ts             # Browser-Client
    server.ts             # Server-Client (Server Components)
middleware.ts              # Session-Refresh
```

Aktuell nur Grundgerüst (Route-Struktur + Supabase-Client-Setup) — die
eigentliche Implementierung ist Ticket 018.

## Setup

```
npm install
cp .env.example .env.local   # echte Werte aus dem Supabase-Projekt eintragen
npm run dev
```

## Kollaborationsregeln

Gelten identisch zum Haupt-Repo (siehe dessen `README.md` und
`CLAUDE.md`): Tests vor Push, eigener Branch, keine Secrets im Repo/Chat,
additive Migrationen bleiben im Haupt-Repo.
