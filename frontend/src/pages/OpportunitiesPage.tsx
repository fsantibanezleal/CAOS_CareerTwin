import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, BriefcaseBusiness, Building2, CalendarClock, Check, FileUp, FolderKanban, Globe2, History, LayoutGrid, Link2, List, MapPin, Network, Plus, Radar, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { api, json } from '../api'
import { OpportunityLandscape, OpportunityNetwork } from '../components/Visualizations'
import { EmptyState, ErrorState, ExternalLink, Loading, PageHeader, Panel } from '../components/Primitives'
import { useI18n } from '../i18n'
import type { Landscape, Opportunity, OpportunityGraphData, OpportunitySnapshot, Requirement, TargetSet } from '../types'

type CaptureMode = 'manual' | 'paste' | 'url' | 'file'

const blank = {
  title: '', employer: '', description: '', source_kind: 'manual', industry: '', area: '', seniority: '', location: '', remote_mode: 'unspecified', status: 'watching', requirements: [] as Requirement[], compensation: {},
}

function CaptureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<CaptureMode>('url')
  const [draft, setDraft] = useState(blank)
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File>()
  const capture = useMutation({
    mutationFn: () => {
      if (mode === 'url') return api<Opportunity>('/api/opportunities/capture-url', json('POST', { url }))
      if (mode === 'file' && file) { const form = new FormData(); form.append('file', file); form.append('title', draft.title); form.append('employer', draft.employer); return api<Opportunity>('/api/opportunities/capture-file', { method: 'POST', body: form }) }
      return api<Opportunity>('/api/opportunities', json('POST', { ...draft, source_kind: mode }))
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['opportunities'] }); client.invalidateQueries({ queryKey: ['landscape'] }); client.invalidateQueries({ queryKey: ['opportunity-graph'] }); client.invalidateQueries({ queryKey: ['today'] }); setDraft(blank); setUrl(''); setFile(undefined); onClose() },
  })
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-modal" role="dialog" aria-modal="true" aria-labelledby="capture-title"><header><div><span className="eyebrow"><Sparkles /> {t('Bounded capture')}</span><h2 id="capture-title">{t('Add an opportunity')}</h2><p>{t('Bring one posting into your private research workspace, then review every extracted requirement.')}</p></div><button className="icon-button" onClick={onClose} aria-label={t('Close capture dialog')}><X /></button></header>
        <nav className="capture-tabs">{([['url', <Link2 />, 'From URL'], ['file', <FileUp />, 'From document'], ['paste', <List />, 'Paste text'], ['manual', <Plus />, 'Manual']] as Array<[CaptureMode, React.ReactNode, string]>).map(([key, icon, label]) => <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>{icon}{t(label)}</button>)}</nav>
        <form onSubmit={(event) => { event.preventDefault(); capture.mutate() }}>
          {mode === 'url' && <label>{t('Public job posting URL')}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} required placeholder="https://company.example/careers/role" /><small>{t('Redirects and every resolved IP are checked against SSRF protections. No authenticated or local pages.')}</small></label>}
          {mode === 'file' && <><div className="drop-zone" onClick={() => fileRef.current?.click()}><FileUp /><b>{file?.name || t('Choose a job description document')}</b><span>{t('PDF, DOCX, text, Markdown, or HTML · malware-scanned in production')}</span></div><input ref={fileRef} hidden type="file" accept=".pdf,.docx,.txt,.md,.html" onChange={(event) => setFile(event.target.files?.[0])} required /><div className="form-grid two"><label>{t('Title override')}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>{t('Employer override')}<input value={draft.employer} onChange={(event) => setDraft({ ...draft, employer: event.target.value })} /></label></div></>}
          {(mode === 'paste' || mode === 'manual') && <><div className="form-grid two"><label>{t('Role title')}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label><label>{t('Employer')}<input value={draft.employer} onChange={(event) => setDraft({ ...draft, employer: event.target.value })} /></label></div><label>{t(mode === 'paste' ? 'Paste the complete posting' : 'Description')}<textarea rows={10} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><div className="form-grid three"><label>{t('Industry')}<input value={draft.industry} onChange={(event) => setDraft({ ...draft, industry: event.target.value })} /></label><label>{t('Seniority')}<input value={draft.seniority} onChange={(event) => setDraft({ ...draft, seniority: event.target.value })} /></label><label>{t('Location')}<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label></div></>}
          {capture.error && <ErrorState error={capture.error} />}
          <footer><span>{t('Captured data remains a private snapshot in your workspace.')}</span><button className="button primary" disabled={capture.isPending || (mode === 'file' && !file)}>{t(capture.isPending ? 'Capturing…' : 'Capture for review')}</button></footer>
        </form>
      </section>
    </div>
  )
}

function RequirementEditor({ opportunity }: { opportunity: Opportunity }) {
  const { plural, t, formatDate } = useI18n()
  const client = useQueryClient()
  const history = useQuery({ queryKey: ['opportunity-history', opportunity.id], queryFn: () => api<OpportunitySnapshot[]>(`/api/opportunities/${opportunity.id}/history`) })
  const [draft, setDraft] = useState(opportunity)
  const update = useMutation({ mutationFn: () => api(`/api/opportunities/${opportunity.id}`, json('PUT', { ...draft, source_url: draft.source_url || null, requirements: draft.requirements.map((item) => ({ category: item.category, label: item.label, normalized_name: item.normalized_name, taxonomy_uri: item.taxonomy_uri, importance: item.importance, weight: item.weight, minimum_level: item.minimum_level, source_locator: item.source_locator })) })), onSuccess: () => { client.invalidateQueries({ queryKey: ['opportunities'] }); client.invalidateQueries({ queryKey: ['landscape'] }); client.invalidateQueries({ queryKey: ['opportunity-graph'] }) } })
  const propose = useMutation({ mutationFn: () => api<Requirement[]>(`/api/opportunities/${opportunity.id}/propose-requirements`, { method: 'POST' }), onSuccess: (values) => setDraft((current) => ({ ...current, requirements: values.map((value, index) => ({ ...value, id: `proposal-${index}` })) })) })
  const field = (key: keyof Opportunity, value: unknown) => setDraft((current) => ({ ...current, [key]: value }))
  const addRequirement = () => setDraft((current) => ({ ...current, requirements: [...current.requirements, { id: `new-${crypto.randomUUID()}`, category: 'skill', label: '', normalized_name: '', importance: 'required', weight: 1, source_locator: {} }] }))
  const requirement = (id: string, key: keyof Requirement, value: unknown) => setDraft((current) => ({ ...current, requirements: current.requirements.map((item) => item.id === id ? { ...item, [key]: value } : item) }))
  return (
    <Panel title={t('Opportunity intelligence')} subtitle={t('Version {version} · extraction is editable, never silently canonical', { version: opportunity.version })} actions={draft.source_url && <ExternalLink href={draft.source_url}>{t('Source')}</ExternalLink>}>
      <form className="opportunity-editor" onSubmit={(event) => { event.preventDefault(); update.mutate() }}><div className="form-grid two"><label>{t('Role title')}<input value={draft.title} onChange={(event) => field('title', event.target.value)} /></label><label>{t('Employer')}<input value={draft.employer} onChange={(event) => field('employer', event.target.value)} /></label></div><label>{t('Posting text')}<textarea rows={8} value={draft.description} onChange={(event) => field('description', event.target.value)} /></label><div className="form-grid four"><label>{t('Industry')}<input value={draft.industry} onChange={(event) => field('industry', event.target.value)} /></label><label>{t('Area')}<input value={draft.area} onChange={(event) => field('area', event.target.value)} /></label><label>{t('Seniority')}<input value={draft.seniority} onChange={(event) => field('seniority', event.target.value)} /></label><label>{t('Work mode')}<select value={draft.remote_mode} onChange={(event) => field('remote_mode', event.target.value)}>{['unspecified', 'remote', 'hybrid', 'onsite'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label></div>
        <div className="requirement-header"><div><h3>{t('Atomic requirements')}</h3><p>{t('Eligibility is evaluated separately from weighted alignment.')}</p></div><div><button type="button" className="button ghost" onClick={() => propose.mutate()}><Sparkles /> {t('Re-extract')}</button><button type="button" className="button secondary" onClick={addRequirement}><Plus /> {t('Add')}</button></div></div>
        <div className="requirements-list">{draft.requirements.map((item) => <div key={item.id}><select value={item.importance} onChange={(event) => requirement(item.id, 'importance', event.target.value)}>{['eligibility', 'required', 'preferred'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select><select value={item.category} onChange={(event) => requirement(item.id, 'category', event.target.value)}>{['skill', 'experience', 'education', 'location', 'authorization', 'language'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select><input value={item.label} onChange={(event) => requirement(item.id, 'label', event.target.value)} placeholder={t('Requirement')} /><label>{t('Weight')}<input type="number" min="0" max="10" step="0.25" value={item.weight} onChange={(event) => requirement(item.id, 'weight', Number(event.target.value))} /></label><button type="button" className="icon-button" aria-label={t('Delete requirement')} onClick={() => setDraft((current) => ({ ...current, requirements: current.requirements.filter((value) => value.id !== item.id) }))}><X /></button></div>)}</div>
        {(update.error || propose.error) && <ErrorState error={update.error || propose.error} />}
        <details className="evidence-history"><summary><History /> {t('Immutable revision history ({count})', { count: history.data?.length ?? 0 })}</summary>{history.data?.map((item) => <div key={item.id}><span className="status-badge">{t('Version {version}', { version: item.version })}</span><p><b>{item.snapshot.title}</b> · {plural(item.snapshot.requirements.length, '{count} requirement', '{count} requirements')} · {formatDate(item.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p></div>)}</details>
        <div className="form-actions"><span>{plural(draft.requirements.length, '{count} requirement under your control', '{count} requirements under your control')}</span><button className="button primary"><Check /> {t('Save reviewed version')}</button></div>
      </form>
    </Panel>
  )
}

function TargetSetManager({ opportunities }: { opportunities: Opportunity[] }) {
  const { plural, t } = useI18n()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const targetSets = useQuery({ queryKey: ['target-sets'], queryFn: () => api<TargetSet[]>('/api/opportunities/target-sets') })
  const create = useMutation({
    mutationFn: () => api<TargetSet>('/api/opportunities/target-sets', json('POST', { name, description: '', opportunity_ids: selected, strategy: { weighting: 'equal' } })),
    onSuccess: () => { setName(''); setSelected([]); client.invalidateQueries({ queryKey: ['target-sets'] }); client.invalidateQueries({ queryKey: ['opportunity-graph'] }) },
  })
  const remove = useMutation({ mutationFn: (id: string) => api(`/api/opportunities/target-sets/${id}`, { method: 'DELETE' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['target-sets'] }); client.invalidateQueries({ queryKey: ['opportunity-graph'] }) } })
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  return (
    <Panel title={t('Target portfolios')} subtitle={t('Save named job-search scenarios so global alignment always has an explicit denominator')} actions={<span className="status-badge"><FolderKanban /> {plural(targetSets.data?.length ?? 0, '{count} set', '{count} sets')}</span>}>
      <form className="target-set-compose" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <label>{t('Portfolio name')}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Remote platform leadership')} required /></label>
        <fieldset><legend>{t('Include saved opportunities')}</legend><div className="target-options">{opportunities.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /><span><b>{item.title}</b><small>{item.employer || t('Employer unknown')}</small></span></label>)}</div></fieldset>
        <button className="button primary" disabled={!selected.length || create.isPending}><Plus /> {t('Save target portfolio')}</button>
      </form>
      {(targetSets.error || create.error || remove.error) && <ErrorState error={targetSets.error || create.error || remove.error} />}
      {targetSets.data?.length ? <div className="target-set-list">{targetSets.data.map((item) => <article key={item.id}><div><b>{item.name}</b><small>{plural(item.opportunity_ids.length, '{count} role · explicit scenario', '{count} roles · explicit scenario')}</small></div><button className="icon-button" aria-label={t('Delete {name}', { name: item.name })} onClick={() => remove.mutate(item.id)}><Trash2 /></button></article>)}</div> : <EmptyState title={t('No target portfolio yet')} description={t('Select the roles you genuinely want to compare as one career-search scenario.')} />}
    </Panel>
  )
}

export function OpportunitiesPage() {
  const { plural, t, formatDate } = useI18n()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [view, setView] = useState<'cards' | 'landscape' | 'network'>('cards')
  const [queryText, setQueryText] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities'), refetchInterval: (query) => (query.state.data as Opportunity[] | undefined)?.some((item) => ['pending', 'processing'].includes(String(item.structured_data.capture_status))) ? 2000 : false })
  const landscape = useQuery({ queryKey: ['landscape'], queryFn: () => api<Landscape>('/api/opportunities/visualization/landscape') })
  const graph = useQuery({ queryKey: ['opportunity-graph'], queryFn: () => api<OpportunityGraphData>('/api/opportunities/visualization/graph') })
  const filtered = useMemo(() => (opportunities.data ?? []).filter((item) => `${item.title} ${item.employer} ${item.industry}`.toLowerCase().includes(queryText.toLowerCase())), [opportunities.data, queryText])
  const selected = opportunities.data?.find((item) => item.id === selectedId)
  if (opportunities.isPending || landscape.isPending || graph.isPending) return <Loading label={t('Organizing your opportunity research')} />
  if (opportunities.error || landscape.error || graph.error) return <ErrorState error={opportunities.error || landscape.error || graph.error} />
  return (
    <>
      <PageHeader eyebrow={t('Opportunity research')} title={t('Collect signals. Keep the source. Decide what matters.')} description={t('Capture individual roles from public pages or documents, review the structure, and understand patterns only within your saved research.')} actions={<button className="button primary" onClick={() => setCaptureOpen(true)}><Plus /> {t('Add opportunity')}</button>} />
      <TargetSetManager opportunities={opportunities.data} />
      <div className="list-toolbar"><label className="search-field"><Search /><input placeholder={t('Search roles, employers, industries…')} value={queryText} onChange={(event) => setQueryText(event.target.value)} /></label><div className="segmented"><button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><LayoutGrid /> {t('Research cards')}</button><button className={view === 'network' ? 'active' : ''} onClick={() => setView('network')}><Network /> {t('Knowledge graph')}</button><button className={view === 'landscape' ? 'active' : ''} onClick={() => setView('landscape')}><Radar /> {t('Landscape')}</button></div></div>
      {view === 'landscape' ? <Panel title={t('Your search landscape')} subtitle={t('A descriptive view of saved roles—not the global labor market')}><OpportunityLandscape data={landscape.data} /></Panel> : view === 'network' ? <Panel title={t('Opportunity knowledge graph')} subtitle={t('Explore how your saved roles, requirements, employers, and target scenarios connect')}><OpportunityNetwork data={graph.data.graph} /><p className="chart-warning">{t(graph.data.warning)}</p></Panel> : <div className="opportunities-layout"><section className="opportunity-cards">{filtered.length ? filtered.map((item) => <button key={item.id} className={`opportunity-card ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}><header><span className="company-mark"><Building2 /></span><span className={`status-badge ${item.status}`}>{t(item.status)}</span></header><h2>{item.title}</h2><p>{item.employer || t('Employer not specified')}</p><div className="opportunity-meta"><span><MapPin />{item.location || t(item.remote_mode)}</span><span><BriefcaseBusiness />{item.seniority || t('Seniority unknown')}</span>{item.deadline_at && <span><CalendarClock />{formatDate(item.deadline_at)}</span>}</div><footer><span>{plural(item.requirements.length, '{count} structured requirement', '{count} structured requirements')}</span><ArrowUpRight /></footer></button>) : <EmptyState title={t('No opportunity matches this view')} description={t('Capture a role from a URL, document, pasted text, or manual entry.')} action={<button className="button primary" onClick={() => setCaptureOpen(true)}>{t('Add the first role')}</button>} />}</section>{selected ? <RequirementEditor key={`${selected.id}-${selected.version}`} opportunity={selected} /> : filtered.length > 0 && <aside className="selection-hint"><Globe2 /><h3>{t('Select a research card')}</h3><p>{t('Review its extracted content and atomic requirements here.')}</p></aside>}</div>}
      <CaptureDialog open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </>
  )
}
