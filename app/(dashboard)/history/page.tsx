// TODO (Ticket 018): via lib/application/dashboard.ts#getHistory(repos, from, to)
// + CSV/PDF export, matching HistoryLogView.swift / CSVExporter.swift /
// PDFExporter.swift. Pages call lib/application/*, never lib/repositories/*
// directly (hexagonal boundary — see app/(dashboard)/page.tsx).
export default function HistoryPage() {
  return <main className="p-8">Historie — TODO</main>;
}
