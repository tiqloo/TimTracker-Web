// TODO (Ticket 018): "Heute" — via
//   const repos = await getServerRepositories();
//   const today = await getTodayBreakdown(repos);
// Pages call lib/application/* (the core), never lib/repositories/*
// directly — that's the hexagonal boundary: UI is a driving adapter,
// repositories are driven ports/adapters, application/ is the core
// between them.
export default function TodayPage() {
  return <main className="p-8">Heute — TODO</main>;
}
