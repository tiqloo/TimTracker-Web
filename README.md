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
- `@supabase/supabase-js` + `@supabase/ssr` — heutiger Daten-Adapter,
  hinter einer Repository-Schicht gekapselt (siehe unten), kein eigenes
  Backend nötig, solange Supabase (RLS aus dem Haupt-Repo) reicht
- Hosting: Vercel

## Architektur: Repository Pattern (Ports & Adapters)

Seiten/Komponenten greifen **nie** direkt auf Supabase zu — nur auf
Repository-Interfaces (`lib/repositories/*.repository.ts`). Das ist
dieselbe Clean-Architecture-Idee wie in der Swift-App
(`ProjectRepository`-Protokoll + `SupabaseProjectRepository`): heute ist
die einzige Implementierung Supabase-basiert, aber falls später ein
eigenes Backend dazukommt (z. B. für SAP/Outlook/Teams-Integrationen oder
Rechnungsstellung aus der langfristigen Vision), wird nur die
Implementierung getauscht — kein Seiten-Code ändert sich.

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
  types/                  # Domain-Modelle (framework-frei, spiegeln
                           # Domain/Models/*.swift 1:1 in Feldnamen)
    project.ts
    time-entry.ts          # inkl. DailyBreakdown.unassignedSeconds,
                           # dieselbe Formel wie der Ticket-001-Fix
    subscription.ts
  repositories/            # Interfaces — die Tausch-Nahtstelle
    projects.repository.ts
    time-entries.repository.ts
    subscription.repository.ts
    supabase/               # heutige Implementierung dieser Interfaces
      projects.repository.ts
      time-entries.repository.ts
      subscription.repository.ts
    index.ts                # Composition Root — Pendant zu
                             # App/DependencyContainer.swift.
                             # getServerRepositories() / getBrowserRepositories()
                             # sind der EINZIGE Weg, an Daten zu kommen
  supabase/
    client.ts               # Browser-Client (nur von repositories/supabase/ genutzt)
    server.ts                # Server-Client (nur von repositories/supabase/ genutzt)
proxy.ts                    # Session-Refresh
```

**Regel für jede zukünftige Seite:** `import { getServerRepositories }
from "@/lib/repositories"` (Server Component) oder
`getBrowserRepositories()` (Client Component) — niemals `@supabase/supabase-js`
oder `lib/supabase/*` direkt importieren, das ist ausschließlich
Implementierungsdetail der `repositories/supabase/*`-Dateien.

Aktuell: Route-Struktur + volle Repository-Schicht (Interfaces + Supabase-
Implementierung, Build/Lint grün) stehen. Seiten sind noch TODO-Stubs, die
auf die jeweilige Repository-Methode verweisen — die eigentliche UI-
Implementierung ist Ticket 018.

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
