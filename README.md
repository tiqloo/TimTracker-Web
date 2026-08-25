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

Drei Schichten, strikt in eine Richtung abhängig:

```
app/ (Driving Adapter — UI)
   ↓ ruft ausschließlich auf
lib/application/ (Kern — Use Cases)
   ↓ ruft ausschließlich auf
lib/repositories/*.repository.ts (Driven Ports — Interfaces)
   ↑ implementiert von
lib/repositories/supabase/* (Driven Adapter — heutige Implementierung)
```

- **Driving Adapter** (`app/`): SwiftUI-Pendant wäre Presentation. Kennt
  nur `lib/application/*`, nie Repositories oder Supabase direkt.
- **Kern/Use Cases** (`lib/application/`): Pendant zu `Application/UseCases`
  bzw. `Application/Services` in der Swift-App. Enthält die eigentliche
  Business-Logik (z. B. Namens-Trimming/Validierung beim Projekt-Anlegen)
  und ist die einzige Schicht, die Repository-Ports kennen darf.
- **Driven Ports** (`lib/repositories/*.repository.ts`): reine Interfaces,
  Pendant zu `ProjectRepository` (Domain-Protokoll) in der Swift-App —
  die Tausch-Nahtstelle für ein mögliches künftiges eigenes Backend.
- **Driven Adapter** (`lib/repositories/supabase/*`): heutige
  Implementierung der Ports gegen Supabase, Pendant zu
  `SupabaseProjectRepository`. Ein künftiges Backend würde nur hier
  andocken (z. B. `lib/repositories/rest/*` als zweiter Adapter) — weder
  `lib/application/*` noch `app/` ändern sich dabei.

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
  types/                  # Domain-Modelle (framework-frei, spiegeln
                           # Domain/Models/*.swift 1:1 in Feldnamen)
    project.ts
    time-entry.ts          # inkl. DailyBreakdown.unassignedSeconds,
                           # dieselbe Formel wie der Ticket-001-Fix
    subscription.ts
  application/             # KERN — Use Cases, einzige Schicht mit
                           # Business-Logik, einzige die Repositories kennt
    projects.ts             # createProject/renameProject/archiveProject/listProjects
    dashboard.ts             # getTodayBreakdown/getTodayEntries/getHistory
    billing.ts                # getSubscriptionStatus/manageSubscription
  repositories/            # DRIVEN PORTS — Interfaces
    projects.repository.ts
    time-entries.repository.ts
    subscription.repository.ts
    supabase/               # DRIVEN ADAPTER — heutige Implementierung
      projects.repository.ts
      time-entries.repository.ts
      subscription.repository.ts
    index.ts                # Composition Root — Pendant zu
                             # App/DependencyContainer.swift.
                             # getServerRepositories() / getBrowserRepositories()
  supabase/
    client.ts               # Browser-Client (nur von repositories/supabase/ genutzt)
    server.ts                # Server-Client (nur von repositories/supabase/ genutzt)
proxy.ts                    # Session-Refresh
```

**Regel:** `app/*` importiert ausschließlich aus `lib/application/*`.
`lib/application/*` importiert ausschließlich aus `lib/repositories/*.repository.ts`
(die Interfaces, nie `lib/repositories/supabase/*` direkt). Nur
`lib/repositories/index.ts` kennt die konkrete Adapter-Implementierung.

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
