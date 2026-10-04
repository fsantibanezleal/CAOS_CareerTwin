import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookmarkPlus, Check, ChevronLeft, ChevronRight, Globe, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import type { Opportunity } from '../types'
import { EmptyState, ErrorState, ExternalLink, Loading } from './Primitives'

export type JobQuery = {
  provider: 'himalayas' | 'jobicy'; query: string; country?: string; worldwide?: boolean;
  seniority?: string; employment_type?: string; sort?: 'recent' | 'relevant'; page?: number;
  geo?: string; cursor?: string;
}
export type DiscoveredJob = {
  key: string; provider: JobQuery['provider']; title: string; employer: string; source_url: string;
  excerpt: string; description: string; locations: string[]; timezones: string[];
  seniority: string[]; employment_type: string[]; categories: string[];
  salary_min: number | null; salary_max: number | null; currency: string; salary_period: string;
  published_at: string | null; expires_at: string | null; retrieved_at: string;
  import_ticket: string; saved_opportunity_id: string | null;
}
export type JobSearchPage = {
  provider: JobQuery['provider']; jobs: DiscoveredJob[]; cached: boolean; retrieved_at: string;
  skipped_records: number; has_more: boolean; next_page: number | null; next_cursor: string | null;
}
type Preset = { id: string; name: string; search: JobQuery }
type Catalog = { jobicy_locations: Array<{ value: string; label: string }>; jobicy_locations_error: string | null }

/** Explicit remote discovery: source ranking is not alignment, and a preview is not an application. */
export function JobDiscovery({ onImported }: { onImported: (id: string) => void }) {
  const { t, formatDate, locale } = useI18n()
  const client = useQueryClient()
  const [filters, setFilters] = useState<JobQuery>({ provider: 'himalayas', query: '', sort: 'recent' })
  const [presetId, setPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [history, setHistory] = useState<JobQuery[]>([])
  const [position, setPosition] = useState(0)
  const previewHeading = useRef<HTMLHeadingElement>(null)
  const catalog = useQuery({ queryKey: ['job-catalog'], queryFn: () => api<Catalog>('/api/job-search/catalog'), staleTime: 86400000, retry: false })
  const presets = useQuery({ queryKey: ['job-presets'], queryFn: () => api<Preset[]>('/api/job-search/presets'), retry: false })
  const search = useMutation({
    mutationFn: (query: JobQuery) => api<JobSearchPage>('/api/job-search', json('POST', query)),
    onSuccess: () => { setSelectedKey(null); setMobileDetail(false) },
  })
  const save = useMutation({
    mutationFn: (ticket: string) => api<{ created: boolean; opportunity: Opportunity }>('/api/job-search/import', json('POST', { ticket })),
    onSuccess: (result) => {
      for (const key of ['opportunities', 'landscape', 'opportunity-graph', 'workspace']) client.invalidateQueries({ queryKey: [key] })
      onImported(result.opportunity.id)
    },
  })
  const savePreset = useMutation({
    mutationFn: () => api<Preset>('/api/job-search/presets', json('POST', { name: presetName.trim(), search: filters })),
    onSuccess: (preset) => { setPresetName(''); setPresetId(preset.id); client.invalidateQueries({ queryKey: ['job-presets'] }); client.invalidateQueries({ queryKey: ['profile'] }) },
  })
  const removePreset = useMutation({
    mutationFn: (id: string) => api(`/api/job-search/presets/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setPresetId(''); client.invalidateQueries({ queryKey: ['job-presets'] }); client.invalidateQueries({ queryKey: ['profile'] }) },
  })
  const update = (value: Partial<JobQuery>) => { setFilters((current) => ({ ...current, ...value })); search.reset(); save.reset(); setSelectedKey(null); setMobileDetail(false); setPresetId('') }
  const start = () => { setHistory([filters]); setPosition(0); search.mutate(filters) }
  const next = () => {
    const current = history[position]
    if (!search.data?.has_more || !current) return
    const query: JobQuery = { ...current, page: search.data.next_page ?? 1, cursor: search.data.next_cursor ?? '' }
    setHistory((current) => [...current.slice(0, position + 1), query]); setPosition(position + 1); search.mutate(query)
  }
  const previous = () => { const query = history[position - 1]; if (query) { setPosition(position - 1); search.mutate(query) } }
  const selected = search.data?.jobs.find((job) => job.key === selectedKey) ?? search.data?.jobs[0]
  const providerName = (value: JobQuery['provider']) => value === 'himalayas' ? 'Himalayas' : 'Jobicy'
  const salary = (job: DiscoveredJob) => {
    if (job.salary_min === null && job.salary_max === null) return t('Salary not disclosed')
    const amount = [job.salary_min, job.salary_max].filter((value): value is number => value !== null).map((value) => new Intl.NumberFormat(locale === 'es' ? 'es-CL' : 'en-US').format(value)).join(' – ')
    return `${job.currency || t('Currency unknown')} ${amount} / ${job.salary_period ? t(job.salary_period) : t('Period unknown')}`
  }
  return (
    <section className="job-discovery" aria-label={t('Discover job offers')}>
      <form className="job-search-controls" onSubmit={(event) => { event.preventDefault(); start() }}>
        <fieldset disabled={search.isPending || save.isPending}>
          <legend className="sr-only">{t('Public job search filters')}</legend>
          <div className="job-search-main">
            <label>{t('Job source')}<select value={filters.provider} onChange={(event) => { setFilters({ provider: event.target.value as JobQuery['provider'], query: filters.query, sort: 'recent' }); search.reset(); setPresetId(''); setMobileDetail(false) }}><option value="himalayas">Himalayas</option><option value="jobicy">Jobicy</option></select></label>
            <label>{t('Keywords')}<input maxLength={160} value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder={t('Role, skills, or employer')} /></label>
            <button className="button primary" type="submit"><Search />{t(search.isPending ? 'Searching sources…' : 'Search job offers')}</button>
          </div>
          <details className="job-search-advanced"><summary><SlidersHorizontal size={15} />{t('Location and filters')}<span>{filters.worldwide ? t('Worldwide only') : filters.country || filters.geo || t('All locations')}</span></summary>
            {filters.provider === 'himalayas' ? <div className="job-search-filters">
              <label>{t('Country code')}<input value={filters.country ?? ''} maxLength={2} pattern="[A-Z]{2}|" placeholder="CL, US, ES…" disabled={filters.worldwide} onChange={(event) => update({ country: event.target.value.toUpperCase() })} /><small>{t('Two-letter country code; leave empty for all locations.')}</small></label>
              <label>{t('Seniority')}<select value={filters.seniority ?? ''} onChange={(event) => update({ seniority: event.target.value })}><option value="">{t('Any seniority')}</option>{['Entry-level', 'Mid-level', 'Senior', 'Manager', 'Director', 'Executive'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
              <label>{t('Employment type')}<select value={filters.employment_type ?? ''} onChange={(event) => update({ employment_type: event.target.value })}><option value="">{t('Any employment type')}</option>{['Full Time', 'Part Time', 'Contractor', 'Temporary', 'Intern', 'Volunteer', 'Other'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
              <label>{t('Order')}<select value={filters.sort} onChange={(event) => update({ sort: event.target.value as 'recent' | 'relevant' })}><option value="recent">{t('Most recent')}</option><option value="relevant">{t('Source relevance')}</option></select></label>
              <label className="job-worldwide"><input type="checkbox" checked={filters.worldwide ?? false} onChange={(event) => update({ worldwide: event.target.checked, country: '' })} />{t('Worldwide only')}</label>
            </div> : <div className="job-search-filters jobicy-filters"><label>{t('Provider location')}<select value={filters.geo ?? ''} onChange={(event) => update({ geo: event.target.value })}><option value="">{t('All locations')}</option>{catalog.data?.jobicy_locations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select><small>{t('Use LATAM for regional discovery; read each listing for eligibility.')}</small></label>{catalog.data?.jobicy_locations_error && <ErrorState error={new Error(catalog.data.jobicy_locations_error)} />}</div>}
          </details>
          <details className="job-saved-searches"><summary><BookmarkPlus size={15} />{t('Saved searches')}<span>{presets.data?.length ?? 0}</span></summary><div className="job-preset-controls">
            <label>{t('Use a saved search')}<select value={presetId} onChange={(event) => { const preset = presets.data?.find((item) => item.id === event.target.value); if (preset) { setFilters(preset.search); setPresetId(preset.id); search.reset(); setMobileDetail(false) } else setPresetId('') }}><option value="">{t('Choose a search')}</option>{presets.data?.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}</select></label>
            <button type="button" className="icon-button" disabled={!presetId || removePreset.isPending} aria-label={t('Delete saved search')} onClick={() => removePreset.mutate(presetId)}><Trash2 /></button>
            <label>{t('Search name')}<input maxLength={80} value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder={t('Name this search')} /></label>
            <button type="button" className="button secondary" disabled={!presetName.trim() || savePreset.isPending} onClick={() => savePreset.mutate()}>{t('Save search')}</button>
          </div><small>{t('Saved searches run only when you press Search. No automatic polling.')}</small></details>
        </fieldset>
        {(catalog.error || presets.error || savePreset.error || removePreset.error) && <ErrorState error={catalog.error || presets.error || savePreset.error || removePreset.error} />}
      </form>
      <p className="job-source-notice"><Globe size={15} />{t('Remote-job sources only, not the whole local market. Only your search terms leave CareerTwin; your profile and documents do not.')} {filters.provider === 'jobicy' && t('Jobicy shows the last seven days, with a three-hour publication delay.')}</p>
      {search.isPending ? <Loading label={t('Searching public job sources')} /> : search.error ? <ErrorState error={search.error} retry={start} /> : !search.data ? <EmptyState title={t('Find your next opportunity')} description={t('Search a public source, inspect the complete offer, then save it privately for requirements review and matching.')} /> : !search.data.jobs.length ? <EmptyState title={t('No offers found for these filters')} description={t('Try broader keywords or a different location. This is an empty source result, not a measure of your prospects.')} /> : <>
        <div className="job-search-status" role="status"><span>{t('{count} offers on this page', { count: search.data.jobs.length })} · {providerName(search.data.provider)} · {t(search.data.cached ? 'Cached snapshot' : 'Retrieved')} {formatDate(search.data.retrieved_at, { dateStyle: 'short', timeStyle: 'short' })}</span><div><button className="icon-button" type="button" disabled={!position} aria-label={t('Previous results page')} onClick={previous}><ChevronLeft /></button><span>{t('Page {page}', { page: position + 1 })}</span><button className="icon-button" type="button" disabled={!search.data.has_more} aria-label={t('Next results page')} onClick={next}><ChevronRight /></button></div></div>
        {!!search.data.skipped_records && <p className="job-source-notice">{t('{count} unsafe, expired or incomplete records were excluded.', { count: search.data.skipped_records })}</p>}
        <div className={`job-results ${mobileDetail ? 'show-detail' : ''}`}>
          <nav className="job-results-list" aria-label={t('Job search results')}>{search.data.jobs.map((job) => <button className={`job-result-row ${selected?.key === job.key ? 'selected' : ''}`} aria-current={selected?.key === job.key} key={job.key} type="button" onClick={() => { setSelectedKey(job.key); setMobileDetail(true); requestAnimationFrame(() => previewHeading.current?.focus()) }}><span className="job-result-employer">{job.employer || t('Employer unknown')}{job.saved_opportunity_id && <Check size={14} aria-label={t('Already saved')} />}</span><b>{job.title}</b><small>{job.locations.length ? job.locations.map((value) => t(value)).join(' · ') : t('Location restrictions unknown')}</small><span>{salary(job)}</span><small>{job.published_at ? formatDate(job.published_at) : t('Publication date unknown')}</small></button>)}</nav>
          {selected && <article className="job-preview"><button type="button" className="button ghost job-results-back" onClick={() => setMobileDetail(false)}><ArrowLeft />{t('Back to results')}</button><header><span className="eyebrow">{t('Source')}: {providerName(selected.provider)}</span><h2 ref={previewHeading} tabIndex={-1}>{selected.title}</h2><p>{selected.employer || t('Employer unknown')}</p><div className="job-preview-actions"><ExternalLink href={selected.source_url}>{t('Original listing')}</ExternalLink><button type="button" className="button primary" disabled={save.isPending} onClick={() => selected.saved_opportunity_id ? onImported(selected.saved_opportunity_id) : save.mutate(selected.import_ticket)}>{selected.saved_opportunity_id ? <Check /> : <BookmarkPlus />}{t(selected.saved_opportunity_id ? 'Open saved role' : save.isPending ? 'Saving…' : 'Save for review')}</button></div></header>
            {save.error && <ErrorState error={save.error} />}
            <dl className="job-facts"><div><dt>{t('Location restrictions')}</dt><dd>{selected.locations.length ? selected.locations.map((value) => t(value)).join(', ') : t('Unknown; verify with the employer')}</dd></div><div><dt>{t('Timezone restrictions')}</dt><dd>{selected.timezones.join(', ') || t('Not supplied')}</dd></div><div><dt>{t('Seniority')}</dt><dd>{selected.seniority.map((value) => t(value)).join(', ') || t('Not supplied')}</dd></div><div><dt>{t('Employment type')}</dt><dd>{selected.employment_type.map((value) => t(value)).join(', ') || t('Not supplied')}</dd></div><div><dt>{t('Source salary')}</dt><dd>{salary(selected)}</dd></div><div><dt>{t('Published')}</dt><dd>{selected.published_at ? formatDate(selected.published_at) : t('Not supplied')}</dd></div><div><dt>{t('Source expiry')}</dt><dd>{selected.expires_at ? formatDate(selected.expires_at) : t('Not supplied')}</dd></div></dl>
            <p className="job-preview-caveat">{t('Remote does not mean eligible everywhere. Source expiry is not a confirmed application deadline. Saving does not apply or approve requirements.')}</p><section className="job-description"><h3>{t('Full posting')}</h3><p>{selected.description}</p></section><footer><ExternalLink href={selected.source_url}>{t('Listing supplied by {source}', { source: providerName(selected.provider) })}</ExternalLink><span>{t('Preview expires after 15 minutes; rerun search if it cannot be saved.')}</span></footer>
          </article>}
        </div>
      </>}
    </section>
  )
}
