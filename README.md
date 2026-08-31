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
- **Composition Root** (`lib/composition-root.client.ts` /
  `lib/composition-root.server.ts`): verdrahtet Adapter zu Ports, Pendant
  zu `App/DependencyContainer.swift`. Bewusst **außerhalb** von
  `lib/repositories/` (Review vom 2026-08-25) — ein Composition Root ist
  selbst kein Repository/Port, das lag semantisch falsch dort. War
  ursprünglich eine einzige Datei (`lib/composition-root.ts`); am
  2026-08-25 (Ticket 018, Auth-Seiten) in zwei Dateien pro
  Next.js-Runtime-Ziel aufgeteilt — siehe "Gelöste Architektur-Lücke"
  unten für den genauen Grund (ein echter `npm run build`-Fehler, keine
  Vorsichtsmaßnahme auf Verdacht). `lib/composition-root.ts` existiert
  weiterhin als reiner Typ-Re-Export (`Repositories`), damit alte
  Typ-Importe dieses Pfads nicht brechen.

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
    auth.ts                    # register/login/logout/requestPasswordReset/
                               # updatePassword/onAuthStateChange
    client.ts                  # getRepositories() für Client Components —
                               # siehe "Gelöste Architektur-Lücke" unten
    server.ts                  # getRepositories() für Server Components —
                               # dito, Server-Pendant
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
                             # + composition-root.client.ts genutzt)
    server.ts                # Server-Client (nur von repositories/supabase/
                             # + composition-root.server.ts genutzt)
composition-root.ts        # Nur noch Typ-Re-Export (Repositories) —
                           # historischer Importpfad, siehe unten
composition-root.client.ts # Composition Root, Browser-Hälfte —
                           # getBrowserRepositories()
composition-root.server.ts # Composition Root, Server-Hälfte —
                           # getServerRepositories()
proxy.ts                    # Session-Refresh + Route-Schutz (siehe unten)
```

**Regel:** `app/*` importiert ausschließlich aus `lib/application/*`.
`lib/application/*` importiert ausschließlich aus `lib/repositories/repositories.ts`
(das reine Port-Aggregat, nie einen konkreten Adapter, nie den Composition
Root) — **außer** `lib/application/client.ts` und `lib/application/server.ts`,
siehe die gelöste Architektur-Lücke direkt darunter. Nur die
Composition-Root-Dateien kennen Ports UND Adapter gleichzeitig.

### Gelöste Architektur-Lücke: Seiten brauchen Repositories, dürfen aber den Composition Root nicht importieren

Beim Implementieren der Auth-Seiten (Ticket 018, 2026-08-25) zeigte sich
die Lücke, die die ursprüngliche Doku nur andeutete: jede
`lib/application/*`-Funktion nimmt `repos: Repositories` als ersten
Parameter, aber `app/*` darf weder `lib/repositories/*` noch
`lib/composition-root*` importieren, um so ein `Repositories`-Objekt
selbst zu bauen. Gelöst durch **zwei dünne, dedizierte Dateien innerhalb
von `lib/application/`** (bleiben damit für `app/*` importierbar):

- `lib/application/client.ts` — `"use client"`, `getRepositories()` ruft
  `getBrowserRepositories()` auf. Für Client Components.
- `lib/application/server.ts` — `async getRepositories()` ruft
  `getServerRepositories()` auf. Für Server Components/Route Handlers.

Beide enthalten **bewusst keine Fachlogik** — ihr einziger Zweck ist,
die Lücke zu schließen, ohne dass Seiten Ports/Composition Root direkt
kennen müssen. Seiten rufen sie so:

```ts
const repos = getRepositories();       // Client Component
await login(repos, email, password);   // Fachlogik weiterhin in auth.ts
```

`eslint.config.mjs` erzwingt das strukturell, nicht nur per Konvention:
die allgemeine `lib/application/**`-Regel (kein Composition-Root-Import)
schließt exakt diese beiden Dateien aus (`ignores: [...]`), und ein
eigener, enger Regel-Block erlaubt ihnen zwar `@/lib/composition-root*`,
blockiert aber weiterhin `@supabase/supabase-js` und
`lib/repositories/supabase/*` direkt — sie dürfen den Composition Root
erreichen, aber nicht daran vorbei.

**Zweite, davon ausgelöste Lücke — der `npm run build`-Fehler, der zur
Composition-Root-Aufspaltung führte:** Der ursprüngliche einzelne
`lib/composition-root.ts` importierte **beide** Supabase-Clients
(Browser + Server) statisch am Dateianfang. Sobald `lib/application/client.ts`
(ein `"use client"`-Modul) diese Datei importierte, zog Next.js beim Build
den kompletten Modulgraphen — inklusive `lib/supabase/server.ts`, das
`next/headers` (eine Server-Components-exklusive API) nutzt — in das
Client-Bundle und brach mit einem echten Fehler ab ("You're importing a
module that depends on next/headers ... in the Pages Router"), unabhängig
davon, ob der Server-Zweig tatsächlich aufgerufen wird. Gelöst durch
Aufspaltung in `composition-root.client.ts` (nur Browser-Client) und
`composition-root.server.ts` (nur Server-Client, `next/headers`);
`composition-root.ts` bleibt als reiner Typ-Re-Export bestehen, damit
alte `import type { Repositories } from "@/lib/composition-root"`-Importe
nicht brechen. Verifiziert: `npm run build` schlug vor der Aufspaltung
real fehl, danach grün.

**Regel für jede zukünftige Seite:** `getRepositories()` aus
`@/lib/application/client` (Client Component) oder
`@/lib/application/server` (Server Component) holen, das Ergebnis an die
passende `lib/application/*`-Funktion übergeben. Seiten rufen sonst
ausschließlich Funktionen aus `lib/application/*` auf, nie
`getBrowserRepositories()`/`getServerRepositories()` selbst.

Alle Schichtgrenzen sind per ESLint (`no-restricted-imports`,
`eslint.config.mjs`) automatisch erzwungen, nicht nur dokumentiert —
verifiziert durch mehrfach bewusst provozierte Verstöße (inkl. Bare-
Directory-Imports, relativer Importe wie `./supabase/...`, die
Standard-Glob-Pattern nicht treffen, UND — neu am 2026-08-25 — dass
`lib/application/client.ts`/`server.ts` zwar `@/lib/composition-root*`
importieren dürfen, aber weiterhin nicht `@supabase/supabase-js` direkt),
die alle korrekt fehlschlagen.

Aktuell (Stand 2026-08-25): Auth-Seiten (`(auth)/login`, `/register`,
`/reset-password`) vollständig implementiert inkl. Route-Schutz
(`proxy.ts`) — siehe `TimTracker-Starter/docs/tickets/018-account-website.md`
für Details und Testergebnisse. "Heute" (`(dashboard)/page.tsx`) plus die
gemeinsame Nav/Logout-Leiste (`(dashboard)/layout.tsx`) sind seit Phase 1b
(2026-08-25) ebenfalls real implementiert. `history/`, `projects/` und
`settings/*` bleiben TODO-Stubs.

## Setup

```
npm install
cp .env.example .env.local   # siehe unten: lokal (Standard) vs. Produktion
npm run dev
```

### `.env.local`: lokal gegen Docker (Standard), Produktion nur gezielt

**Seit Phase 1b (2026-08-25) ist der neue Standard für `npm run dev`, gegen
den lokalen Docker-Supabase-Stack aus `TimTracker-Starter` zu laufen, nicht
gegen Produktion.** Grund: `TimTracker-Starter/README.md`s
Kollaborationsregel "Never test against the production Supabase project"
gilt laut `CLAUDE.md` identisch für dieses Repo — ein `.env.local`, das
standardmäßig auf Produktion zeigt, widerspricht dieser Regel bei jedem
`npm run dev`, nicht nur bei gezielten Tests. Phase 1a musste noch direkt
gegen Produktion testen, weil damals kein lokaler Stack für dieses Repo
aufgesetzt war; Phase 1b hat das nachgeholt und dabei bestätigt, dass die
lokale Umgebung (vorbestätigte Seed-Nutzer, siehe unten) für den
Alltagsgebrauch tatsächlich besser geeignet ist — keine
E-Mail-Bestätigungs-Hürde, reproduzierbare Testdaten.

```
cd ../TimTracker-Starter
supabase start                 # lokaler Stack, siehe dortiges README
supabase db reset               # wendet Migrationen + supabase/seed.sql an
```

`supabase start` gibt `API_URL` und `PUBLISHABLE_KEY` aus — diese in
`.env.local` eintragen (`NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Vorbestätigte Testnutzer aus
`TimTracker-Starter/supabase/seed.sql`:

| E-Mail | Passwort | Zustand |
| --- | --- | --- |
| `test@timtracker.local` | `testpassword123` | aktives Abo, ein Projekt, zwei Zeiteinträge "heute" |
| `expired@timtracker.local` | `testpassword123` | abgelaufenes/gekündigtes Abo, keine Zeiteinträge — zum Testen von `canUseApp() === false` |

Produktion bleibt für gezielte Einzel-Checks möglich (z. B. Verhalten bei
echter E-Mail-Bestätigungspflicht, wie in Phase 1a dokumentiert) — dafür
`.env.local` bewusst temporär umbiegen und danach wieder auf den lokalen
Stack zurückstellen, nicht als Dauerzustand stehen lassen.

## Kollaborationsregeln

Gelten identisch zum Haupt-Repo (siehe dessen `README.md` und
`CLAUDE.md`): Tests vor Push, eigener Branch, keine Secrets im Repo/Chat,
additive Migrationen bleiben im Haupt-Repo. Insbesondere: lokal gegen
Docker entwickeln/testen (siehe oben), nicht standardmäßig gegen
Produktion.

## Produktions-Deployment (Vercel)

Projekt `gandar-s-projects/timtracker-web`, Domain `tiqloo.com`, mit dem
GitHub-Repo verbunden — ein Push auf `master` sollte automatisch einen
Produktions-Build auslösen.

**Bekannte Falle (2026-08-31):** Vercel prüft den Git-Commit-Autor gegen
verifizierte E-Mail-Adressen des verbundenen GitHub-Accounts. Steht in
`git config --global user.email` eine E-Mail, die bei GitHub nicht als
verifiziert hinterlegt ist, zeigt Vercel im Deployments-Dashboard
`Blocked` mit "GitHub user not found" — der Build startet dann gar
nicht erst, unabhängig vom Code. Symptom sieht dabei leicht nach einem
Netzwerk-/Sandbox-Problem aus (kein Fehler im Terminal, einfach kein
neuer Live-Stand), ist aber ausschließlich im Vercel-Dashboard sichtbar
(Deployments-Liste → Klick auf die betroffene Zeile). Fix: die globale
Git-E-Mail auf eine bei GitHub verifizierte Adresse umstellen (`git
config --global user.email "..."`), dann committen — alte, bereits
geblockte Deployments bleiben geblockt, ein neuer Commit mit korrekter
Autor-Identität geht durch.
