// TODO (Ticket 018): "Heute" — fetch via
//   const { timeEntries } = await getServerRepositories();
//   const [today] = await timeEntries.getBreakdown(todayISO, todayISO);
// Never call Supabase directly from a page — go through
// lib/repositories/index.ts (getServerRepositories/getBrowserRepositories)
// so a future backend swap only touches that one file.
export default function TodayPage() {
  return <main className="p-8">Heute — TODO</main>;
}
