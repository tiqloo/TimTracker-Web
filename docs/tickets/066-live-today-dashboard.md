# Ticket 066 — Heute-Dashboard in Echtzeit aktualisieren

## Problem

Die Heute-Seite liest `time_entries` ausschließlich beim Server-Render. Änderungen aus der Desktop-App erscheinen deshalb erst nach einem manuellen Reload. Bei einem bereits synchronisierten, noch laufenden Eintrag bleibt außerdem die angezeigte Dauer auf dem Zeitpunkt des letzten Renderings stehen.

## Ziel

Die Heute-Seite zeigt neue, geänderte und beendete Zeiteinträge ohne manuellen Reload und zählt einen laufenden Eintrag sichtbar weiter.

## Akzeptanzkriterien

- Änderungen an `public.time_entries` lösen über Supabase Realtime ein `router.refresh()` aus.
- Ein 30-Sekunden-Intervall aktualisiert die Seite als Fallback, wenn Realtime nicht verfügbar ist.
- Beim erneuten Fokussieren des Fensters oder Sichtbarwerden des Tabs werden die Daten aktualisiert.
- Ein laufender Eintrag zählt clientseitig im Sekundentakt weiter, ohne sekündliche Backend-Anfrage.
- Neue Server-Props ersetzen den vorherigen lokalen Zustand von `DayDetail` zuverlässig.
- Realtime-Kanal, Intervalle und Event Listener werden beim Unmount vollständig entfernt.
- RLS bleibt die Autorisierungsgrenze; im Browser wird ausschließlich der Publishable Key verwendet.

## Technischer Ansatz

- Kleiner Client-Controller `TodayLiveRefresh` neben dem serverseitig gerenderten Dashboard.
- Realtime-Abonnement wird ausschließlich im Browser-Composition-Root verdrahtet.
- `router.refresh()` bleibt die einzige Quelle für neue Serverdaten und bestehende Use-Cases.
- `DayDetail` erhält für laufende Einträge eine lokale Uhr; ein stabiler React-Key erzwingt nach Serveraktualisierungen einen frischen Zustand.

## Hinweis zum Backend

`time_entries` muss Bestandteil der Supabase-Publication `supabase_realtime` sein. Der Polling-Fallback funktioniert unabhängig davon. Die Desktop-App muss einen laufenden Eintrag bereits während der Arbeit hochladen; andernfalls kann das Web-Dashboard ihn erst nach dem nächsten Desktop-Sync anzeigen.

