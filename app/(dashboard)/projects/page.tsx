// TODO (Ticket 018): full CRUD via lib/application/projects.ts
// (listProjects/createProject/renameProject/archiveProject) — full
// parity goal, not read-only (see Ticket 014's 2026-08-25 update). Pages
// call lib/application/*, never lib/repositories/* directly.
export default function ProjectsPage() {
  return <main className="p-8">Projekte — TODO</main>;
}
