import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookmarkPlus, Check, Globe, Search, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import type { Opportunity } from '../types'
import type { DiscoveredJob, JobQuery } from './JobDiscovery'
import { EmptyState, ErrorState, ExternalLink, Loading } from './Primitives'
import { mergeBattery } from '../jobBattery'

type Provider = JobQuery['provider']
export type Battery = { searches: JobQuery[]; title_only: boolean }
export type Coverage = { query_id: string; search: JobQuery; status: 'ok' | 'error' | 'not_run'; found: number; source_count: number; skipped_records: number; cached: boolean; error: string; next_search: JobQuery | null }
export type BatteryPage = { jobs: DiscoveredJob[]; coverage: Coverage[]; provenance: Record<string, string[]>; partial: boolean; retrieved_at: string }
type SavedBattery = { id: string; name: string; battery: Battery }
const providers: Provider[] = ['getonbrd', 'himalayas', 'jobicy']
const names: Record<Provider, string> = { getonbrd: 'Get on Board', himalayas: 'Himalayas', jobicy: 'Jobicy' }

/** Explicit public terms drive a bounded multi-source battery; private evidence never leaves the app. */
export function FederatedSearch({ onImported }: { onImported: (id: string) => void }) {
  const { t, locale, formatDate } = useI18n()
  const client = useQueryClient()
  const [terms, setTerms] = useState('')
  const [sources, setSources] = useState<Provider[]>(providers)
  const [country, setCountry] = useState('')
  const [geo, setGeo] = useState('')
  const [titleOnly, setTitleOnly] = useState(false)
  const [batteryName, setBatteryName] = useState('')
  const [savedId, setSavedId] = useState('')
  const [loadedBattery, setLoadedBattery] = useState<Battery | null>(null)
  const [page, setPage] = useState<BatteryPage | null>(null)
  const [selection, setSelection] = useState('')
  const [mobileDetail, setMobileDetail] = useState(false)
  const [research, setResearch] = useState<{ query: string; location: string } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const queries = [...new Set(terms.split('\n').map((value) => value.trim()).filter(Boolean))]
  const queryValues = queries.length ? queries : ['']
  const configuration: Battery = loadedBattery ?? { title_only: titleOnly, searches: sources.flatMap((provider) => queryValues.map((query) => provider === 'jobicy' ? { provider, query, geo } : { provider, query, country })) }
  const invalid = queries.length > 6 || !sources.length || queries.some((query) => query.length > 160 || [...query].some((char) => char.charCodeAt(0) < 32))
  const saved = useQuery({ queryKey: ['job-batteries'], queryFn: () => api<SavedBattery[]>('/api/job-search/batteries'), retry: false })
  const catalog = useQuery({ queryKey: ['job-catalog'], queryFn: () => api<{ jobicy_locations: Array<{ value: string; label: string }>; jobicy_locations_error: string | null }>('/api/job-search/catalog'), staleTime: 86400000, retry: false })
  const links = useQuery({ queryKey: ['job-research-links', research], queryFn: () => api<Array<{ name: string; url: string }>>(`/api/job-search/research-links?${new URLSearchParams(research ?? {})}`), enabled: research !== null, retry: false, refetchOnWindowFocus: false })
  const run = useMutation({
    mutationFn: ({ battery }: { battery: Battery; append: boolean }) => api<BatteryPage>('/api/job-search/battery', json('POST', battery)),
    onSuccess: (result, request) => setPage((old) => request.append && old ? mergeBattery(old, result) : result),
  })
  const save = useMutation({
    mutationFn: (ticket: string) => api<{ opportunity: Opportunity }>('/api/job-search/import', json('POST', { ticket })),
    onSuccess: (result) => { for (const key of ['opportunities', 'landscape', 'opportunity-graph', 'workspace']) client.invalidateQueries({ queryKey: [key] }); onImported(result.opportunity.id) },
  })
  const saveBattery = useMutation({ mutationFn: () => api<SavedBattery>('/api/job-search/batteries', json('POST', { name: batteryName.trim(), battery: configuration })), onSuccess: (result) => { setBatteryName(''); setSavedId(result.id); client.invalidateQueries({ queryKey: ['job-batteries'] }); client.invalidateQueries({ queryKey: ['profile'] }) } })
  const removeBattery = useMutation({ mutationFn: () => api(`/api/job-search/batteries/${savedId}`, { method: 'DELETE' }), onSuccess: () => { setSavedId(''); client.invalidateQueries({ queryKey: ['job-batteries'] }); client.invalidateQueries({ queryKey: ['profile'] }) } })
  const reset = () => { setLoadedBattery(null); setPage(null); setSelection(''); setMobileDetail(false); setSavedId(''); setResearch(null); run.reset(); save.reset() }
  const start = () => { if (invalid) return; setPage(null); setSelection(''); setMobileDetail(false); run.mutate({ battery: configuration, append: false }) }
  const load = (item: SavedBattery) => {
    reset(); setLoadedBattery(item.battery); setSavedId(item.id); setTerms([...new Set(item.battery.searches.map((search) => search.query))].join('\n')); setSources([...new Set(item.battery.searches.map((search) => search.provider))]); setCountry(item.battery.searches.find((search) => search.provider !== 'jobicy')?.country ?? ''); setGeo(item.battery.searches.find((search) => search.provider === 'jobicy')?.geo ?? ''); setTitleOnly(item.battery.title_only)
  }
  const selected = page?.jobs.find((job) => job.key === selection) ?? page?.jobs[0]
  const amount = (job: DiscoveredJob) => {
    if (job.salary_min === null && job.salary_max === null) return t('Salary not disclosed')
    const values = [job.salary_min, job.salary_max].filter((value): value is number => value !== null).map((value) => new Intl.NumberFormat(locale === 'es' ? 'es-CL' : 'en-US').format(value)).join(' – ')
    return `${job.currency || t('Currency unknown')} ${values} / ${job.salary_period ? t(job.salary_period) : t('Period unknown')} · ${job.salary_basis ? t(job.salary_basis) : t('Basis unknown')}`
  }
  return <section className="job-discovery federated-search" aria-label={t('Combined job discovery')}>
    <form className="job-search-controls" onSubmit={(event) => { event.preventDefault(); start() }}>
      <fieldset disabled={run.isPending || save.isPending || saveBattery.isPending || removeBattery.isPending}>
        <legend className="sr-only">{t('Public job search filters')}</legend>
        <div className="battery-main"><label>{t('Search terms, one per line')}<textarea aria-label={t('Search terms, one per line')} rows={2} value={terms} onChange={(event) => { reset(); setTerms(event.target.value) }} placeholder={'Head of Data\nHead of Analytics'} /><small>{t('Up to six distinct queries. All selected sources run in one action.')}</small></label><button type="submit" className="button primary" disabled={invalid}><Search />{t(run.isPending ? 'Searching sources…' : 'Search all selected sources')}</button></div>
        {invalid && <p role="alert">{t('Choose a source and use at most six queries.')}</p>}
        <div className="battery-sources">{providers.map((provider) => <label key={provider}><input type="checkbox" checked={sources.includes(provider)} onChange={(event) => { reset(); setSources(event.target.checked ? [...sources, provider] : sources.filter((item) => item !== provider)) }} />{names[provider]}</label>)}<button type="button" className="button ghost" onClick={() => { reset(); setTerms('Head of Data\nHead of Analytics\nHead of Data Science\nHead of Innovation\nSubgerente IA\nSubgerente Analitica') }}>{t('Load leadership battery')}</button></div>
        <details className="job-search-advanced"><summary>{t('Location and filters')}</summary><div className="form-grid three"><label>{t('Country code')}<input maxLength={2} pattern="[A-Z]{2}|" value={country} placeholder="CL" onChange={(event) => { reset(); setCountry(event.target.value.toUpperCase()) }} /><small>{t('Applied to Get on Board and Himalayas only.')}</small></label><label>{t('Provider location')}<select value={geo} onChange={(event) => { reset(); setGeo(event.target.value) }}><option value="">{t('All locations')}</option>{catalog.data?.jobicy_locations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select><small>{t('Jobicy location only. LATAM is regional, not Chile eligibility.')}</small></label><label className="job-worldwide"><input type="checkbox" checked={titleOnly} onChange={(event) => { reset(); setTitleOnly(event.target.checked) }} />{t('Require query words in the title')}</label></div></details>
        <details className="job-saved-searches"><summary>{t('Saved search batteries')} ({saved.data?.length ?? 0})</summary><div className="job-preset-controls"><label>{t('Use a saved battery')}<select value={savedId} onChange={(event) => { const item = saved.data?.find((value) => value.id === event.target.value); if (item) load(item); else setSavedId('') }}><option value="">{t('Choose a search')}</option>{saved.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" className="icon-button" disabled={!savedId} aria-label={t('Delete saved battery')} onClick={() => removeBattery.mutate()}><Trash2 /></button><label>{t('Search name')}<input maxLength={80} value={batteryName} onChange={(event) => setBatteryName(event.target.value)} /></label><button type="button" className="button secondary" disabled={invalid || !batteryName.trim()} onClick={() => saveBattery.mutate()}>{t('Save battery')}</button></div><small>{t('Saved searches run only when you press Search. No automatic polling.')}</small></details>
      </fieldset>
      {(saved.error || catalog.error || saveBattery.error || removeBattery.error) && <ErrorState error={saved.error || catalog.error || saveBattery.error || removeBattery.error} />}
      {sources.includes('jobicy') && catalog.data?.jobicy_locations_error && <ErrorState error={new Error(t(catalog.data.jobicy_locations_error))} retry={() => catalog.refetch()} />}
    </form>
    <p className="job-source-notice"><Globe size={15} />{t('Selected public terms only; your profile, pay and documents are never sent to job sources. Coverage is limited to these sources and pages, not the whole market.')}</p>
    {run.error && <ErrorState error={run.error} retry={start} />}
    {run.isPending && <Loading label={t('Searching public job sources')} />}
    {page && <details className="battery-coverage" open={page.partial}><summary>{t('Source coverage')} · {page.coverage.filter((item) => item.status === 'ok').length}/{page.coverage.length} · {t('{count} unique offers', { count: page.jobs.length })}</summary><div className="battery-coverage-grid">{page.coverage.map((item) => <article key={item.query_id}><header><b>{names[item.search.provider]}</b><span className={`status-badge ${item.status === 'ok' ? 'confirmed' : 'proposed'}`}>{t(item.status === 'ok' ? 'Retrieved' : item.status === 'error' ? 'Unavailable' : 'Not run')}</span></header><p>{item.search.query || t('All roles')} · {t('{count} offers on this page', { count: item.found })}{item.cached ? ` · ${t('Cached snapshot')}` : ''}</p>{item.skipped_records > 0 && <small>{t('{count} unsafe, expired or incomplete records were excluded.', { count: item.skipped_records })}</small>}{item.error && <p role="status">{t(item.error)}</p>}{(item.next_search || item.status !== 'ok') && <button type="button" className="button secondary" disabled={run.isPending} onClick={() => run.mutate({ battery: { title_only: titleOnly, searches: [item.next_search ?? item.search] }, append: true })}>{t(item.next_search ? 'More from this query' : 'Retry this query')}</button>}</article>)}</div></details>}
    {!page && !run.isPending && !run.error && <EmptyState title={t('Find your next opportunity')} description={t('Run one combined battery, inspect source coverage and complete postings, then explicitly save selected roles for review.')} />}
    {page && !page.jobs.length && <EmptyState title={t(page.coverage.some((item) => item.status === 'ok') ? 'No offers found for these filters' : 'Search sources unavailable')} description={t(page.coverage.some((item) => item.status === 'ok') ? 'Try broader keywords or a different location. This is an empty source result, not a measure of your prospects.' : 'No source completed successfully. Inspect coverage and retry; this is not an empty job market.')} />}
    {page && page.jobs.length > 0 && <div className={`job-results ${mobileDetail ? 'show-detail' : ''}`}><nav className="job-results-list" aria-label={t('Job search results')}>{page.jobs.map((job) => <button key={job.key} type="button" className={`job-result-row ${selected?.key === job.key ? 'selected' : ''}`} aria-current={selected?.key === job.key} onClick={() => { setSelection(job.key); setMobileDetail(true); requestAnimationFrame(() => heading.current?.focus()) }}><span className="job-result-employer">{job.employer || t('Employer unknown')}{job.saved_opportunity_id && <Check size={14} />}</span><b>{job.title}</b><small>{names[job.provider]} · {job.locations.join(' · ') || t('Location restrictions unknown')}</small><span>{amount(job)}</span><small>{job.published_at ? formatDate(job.published_at) : t('Publication date unknown')}</small></button>)}</nav>{selected && <article className="job-preview"><button type="button" className="button ghost job-results-back" onClick={() => setMobileDetail(false)}><ArrowLeft />{t('Back to results')}</button><header><span className="eyebrow">{t('Source')}: {names[selected.provider]}</span><h2 tabIndex={-1} ref={heading}>{selected.title}</h2><p>{selected.employer || t('Employer unknown')}</p><div className="job-preview-actions"><ExternalLink href={selected.source_url}>{t('Original listing')}</ExternalLink><button type="button" className="button primary" disabled={save.isPending || run.isPending} onClick={() => selected.saved_opportunity_id ? onImported(selected.saved_opportunity_id) : save.mutate(selected.import_ticket)}><BookmarkPlus />{t(selected.saved_opportunity_id ? 'Open saved role' : 'Save for review')}</button></div></header>{save.error && <ErrorState error={save.error} />}<dl className="job-facts"><div><dt>{t('Location restrictions')}</dt><dd>{selected.locations.join(', ') || t('Unknown; verify with the employer')}</dd></div><div><dt>{t('Work modality')}</dt><dd>{t(selected.remote_mode ?? 'unspecified')}</dd></div><div><dt>{t('Source salary')}</dt><dd>{amount(selected)}</dd></div><div><dt>{t('Seniority')}</dt><dd>{selected.seniority.join(', ') || t('Not supplied')}</dd></div><div><dt>{t('Published')}</dt><dd>{selected.published_at ? formatDate(selected.published_at) : t('Not supplied')}</dd></div><div><dt>{t('Retrieved')}</dt><dd>{formatDate(selected.retrieved_at)}</dd></div></dl><p className="job-preview-caveat">{t('Remote does not mean eligible everywhere. Source expiry is not a confirmed application deadline. Saving does not apply or approve requirements.')}</p><p className="job-preview-caveat">{t('An application button or repost date does not prove a vacancy remains open. Verify the current employer requisition, authority and compensation before treating it as a worthwhile move.')}</p><section className="job-description"><h3>{t('Full posting')}</h3><p>{selected.description}</p></section><footer><ExternalLink href={selected.source_url}>{t('Listing supplied by {source}', { source: names[selected.provider] })}</ExternalLink><span>{t('Preview expires after 15 minutes; rerun search if it cannot be saved.')}</span></footer></article>}</div>}
    <details className="job-search-advanced assisted-research"><summary>{t('Additional sites and employer research')}</summary><p>{t('These links open external research. They are not searched by the battery; no result counts or verified offers are claimed.')}</p><button type="button" className="button secondary" onClick={() => setResearch({ query: queries[0] ?? '', location: country || geo })}>{t('Prepare links using the first query')}</button>{links.error && <ErrorState error={links.error} />}<div className="research-links">{links.data?.map((link) => <ExternalLink key={link.name} href={link.url}>{link.name}</ExternalLink>)}</div></details>
  </section>
}
