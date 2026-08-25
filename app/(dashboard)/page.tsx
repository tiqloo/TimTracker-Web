export default function TodayPage() {
  // TODO (Ticket 018): "Heute" — Automatikzeit, Projektzeit, Nicht
  // zugeordnete Zeit. Same DailyBreakdown.unassignedSeconds formula as
  // the macOS app (Application/Interfaces/DailyBreakdown.swift), read via
  // lib/supabase/server.ts against the same projects/time_entries tables.
  return <main className="p-8">Heute — TODO</main>;
}
