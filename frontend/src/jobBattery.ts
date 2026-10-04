import type { BatteryPage } from './components/FederatedSearch'

/** Merge exact source URLs and source/query identities; never guess employer/title equivalence. */
export function mergeBattery(previous: BatteryPage, next: BatteryPage): BatteryPage {
  const jobs = new Map(previous.jobs.map((job) => [job.source_url, job]))
  next.jobs.forEach((job) => jobs.set(job.source_url, job))
  const coverage = new Map(previous.coverage.map((item) => [item.query_id, item]))
  next.coverage.forEach((item) => coverage.set(item.query_id, item))
  const provenance = { ...previous.provenance }
  for (const [key, values] of Object.entries(next.provenance)) provenance[key] = [...new Set([...(provenance[key] ?? []), ...values])]
  return { ...next, jobs: [...jobs.values()], coverage: [...coverage.values()], provenance, partial: [...coverage.values()].some((item) => item.status !== 'ok') }
}
