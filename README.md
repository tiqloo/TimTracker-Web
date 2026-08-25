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

## Architektur: Hexagonal (Ports & Adapters)

Vier Schichten, strikt in eine Richtung abhängig:

```
app/ (Driving Adapter — UI)
   ↓ ruft ausschließlich auf
lib/application/ (Kern — Use Cases)
   ↓ ruft ausschließlich auf
lib/repositories/*.repository.ts (Driven Ports — Interfaces)
   ↑ implementiert von
lib/repositories/supabase/* (Driven Adapter — heutige Implementierung)
   ↑ verdrahtet von
lib/composition-root.ts (Composition Root)
```

- **Driving Adapter** (`app/`): SwiftUI-Pendant wäre Presentation. Kennt
  nur `lib/application/*`, nie Repositories, Composition Root oder
  Supabase direkt.
- **Kern/Use Cases** (`lib/application/`): Pendant zu `Application/UseCases`
  bzw. `Application/Services` in der Swift-App. Enthält die eigentliche
  Business-Logik (z. B. Namens-Trimming/Validierung beim Projekt-Anlegen)
  und ist die einzige Schicht, die Repository-Ports kennen darf — nie den
  Composition Root oder einen konkreten Adapter.
- **Driven Ports** (`lib/repositories/*.repository.ts`): reine Interfaces,
  Pendant zu `ProjectRepository` (Domain-Protokoll) in der Swift-App —
  die Tausch-Nahtstelle für ein mögliches künftiges eigenes Backend.
- **Driven Adapter** (`lib/repositories/supabase/*`): heutige
  Implementierung der Ports gegen Supabase, Pendant zu
  `SupabaseProjectRepository`. Ein künftiges Backend würde nur hier
  andocken (z. B. `lib/repositories/rest/*` als zweiter Adapter) — weder
  `lib/application/*` noch `app/` ändern sich dabei.
- **Composition Root** (`lib/composition-root.ts`): verdrahtet Adapter zu
  Ports, Pendant zu `App/DependencyContainer.swift`. Bewusst **außerhalb**
  von `lib/repositories/` (Review vom 2026-08-25) — ein Composition Root
  ist selbst kein Repository/Port, das lag semantisch falsch dort.

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
      billing/            # "Abo verwalten"
lib/
  domain/                 # Domain-Modelle + echte Fachlogik (framework-frei,
                           # spiegeln Domain/Models/*.swift 1:1 in Feldnamen)
    project.ts
    time-entry.ts          # inkl. DailyBreakdown.unassignedSeconds,
                           # dieselbe Formel wie der Ticket-001-Fix
    subscription.ts         # inkl. canUseApp() — dieselbe Bedingung wie
                           # die RLS-Policy in 0001_init.sql/0003_trial.sql,
                           # nicht nur ein Datentyp
  application/             # KERN — Use Cases, einzige Schicht mit
                           # Business-Logik, einzige die Ports kennt
    projects.ts             # createProject/renameProject/archiveProject/listProjects
    dashboard.ts             # getTodayBreakdown/getTodayEntries/getHistory
    billing.ts                # getSubscriptionStatus/manageSubscription
    auth.ts                    # register/login/logout/requestPasswordReset
  repositories/            # DRIVEN PORTS — Interfaces
    projects.repository.ts
    time-entries.repository.ts
    subscription.repository.ts
    auth.repository.ts
    repositories.ts          # reines Port-Aggregat (Repositories-Interface),
                             # KEIN Adapter-Import — das ist es, was
                             # lib/application/* importieren darf
    supabase/               # DRIVEN ADAPTER — heutige Implementierung
      projects.repository.ts
      time-entries.repository.ts
      subscription.repository.ts
      auth.repository.ts
  supabase/
    client.ts               # Browser-Client (nur von repositories/supabase/
                             # + composition-root.ts genutzt)
    server.ts                # Server-Client (dito)
composition-root.ts        # Composition Root — einzige Datei, die Adapter
                           # UND Ports kennt. getServerRepositories() /
                           # getBrowserRepositories()
proxy.ts                    # Session-Refresh
```

**Regel:** `app/*` importiert ausschließlich aus `lib/application/*`.
`lib/application/*` importiert ausschließlich aus `lib/repositories/repositories.ts`
(das reine Port-Aggregat, nie einen konkreten Adapter, nie den Composition
Root). Nur `lib/composition-root.ts` kennt Ports UND Adapter gleichzeitig.

**Regel für jede zukünftige Seite:** `import { getServerRepositories }
from "@/lib/composition-root"` (Server Component) oder
`getBrowserRepositories()` (Client Component) — aber **nur innerhalb von
`lib/application/*`**, niemals direkt aus `app/*`. Seiten rufen
ausschließlich Funktionen aus `lib/application/*` auf.

Alle vier Schichtgrenzen sind per ESLint (`no-restricted-imports`,
`eslint.config.mjs`) automatisch erzwungen, nicht nur dokumentiert —
verifiziert durch mehrfach bewusst provozierte Verstöße (inkl. Bare-
Directory-Imports und relativer Importe wie `./supabase/...`, die
Standard-Glob-Pattern nicht treffen), die alle korrekt fehlschlagen.

Aktuell: Route-Struktur + vollständige Ports/Adapter/Kern-Schicht (Build/
Lint grün) stehen. Seiten sind noch TODO-Stubs, die auf die jeweilige
Application-Funktion verweisen — die eigentliche UI-Implementierung ist
Ticket 018.

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
