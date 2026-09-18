import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, CircleOff, Compass, Lightbulb, ListTodo, Play, Save, ShieldQuestion, Target, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api, json } from '../api'
import { CoverageWorkbench } from '../components/CoverageWorkbench'
import { useClaims } from '../useClaims'
import { SalaryBand } from '../components/SalaryBand'
import { MatchWaterfall } from '../components/Visualizations'
import { EmptyState, ErrorState, Loading, Panel, Score } from '../components/Primitives'
import { useI18n } from '../i18n'
import type { MatchRun, Opportunity, Recommendation, TargetSet } from '../types'

const statusIcon = {
  met: <CheckCircle2 />, partial: <CircleHelp />, missing: <CircleOff />, unknown: <ShieldQuestion />, conflict: <AlertTriangle />,
} as const

function localizedRecommendation(t: (key: string, values?: Record<string, string | number>) => string, item: { kind: string; title: string }) {
  const prefixes: Record<string, string> = { evidence: 'Add evidence for ', capability: 'Strengthen ', presentation: 'Clarify ' }
  const prefix = prefixes[item.kind]
  return prefix && item.title.startsWith(prefix) ? t(`${prefix}{label}`, { label: item.title.slice(prefix.length) }) : item.title
}

function localizedExplanation(t: (key: string, values?: Record<string, string | number>) => string, explanation: string) {
  const prefix = 'Best supported profile capability: '
  return explanation.startsWith(prefix) ? t('Best supported profile capability: {skill}.', { skill: explanation.slice(prefix.length).replace(/\.$/, '') }) : t(explanation)
}

function RecommendationCard({ item }: { item: Recommendation }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [status, setStatus] = useState(item.status)
  const [progress, setProgress] = useState(item.progress)
  const [prerequisites, setPrerequisites] = useState(item.prerequisites.join(', '))
  const [steps, setSteps] = useState(item.steps.map((step) => String(step.title ?? '')).filter(Boolean).join('\n'))
  const update = useMutation({
    mutationFn: () => api<Recommendation>(`/api/matches/recommendations/${item.id}`, json('PATCH', {
      status,
      progress,
      prerequisites: prerequisites.split(',').map((value) => value.trim()).filter(Boolean),
      steps: steps.split('\n').map((title) => title.trim()).filter(Boolean).map((title) => ({ title, done: false })),
    })),
    onSuccess: (value) => { setStatus(value.status); setProgress(value.progress); client.invalidateQueries({ queryKey: ['recommendations'] }) },
  })
  const makeTask = useMutation({ mutationFn: () => api(`/api/matches/recommendations/${item.id}/task`, { method: 'POST' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['recommendations'] }); client.invalidateQueries({ queryKey: ['tasks'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  return (
    <article><header><span className="status-badge">{t(item.kind)}</span><b>{t('Priority {count}', { count: Math.round(item.priority * 100) })}</b></header><h3>{localizedRecommendation(t, item)}</h3><p>{t(item.rationale)}</p><div><span>{t('Impact')} <i style={{ width: `${item.impact * 100}%` }} /></span><span>{t('Effort')} <i style={{ width: `${item.effort * 100}%` }} /></span></div>
      <div className="recommendation-plan"><label>{t('Status')}<select value={status} onChange={(event) => setStatus(event.target.value)}>{['suggested', 'planned', 'doing', 'completed', 'dismissed'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label><label>{t('Progress')} <b>{Math.round(progress * 100)}%</b><input type="range" min="0" max="1" step="0.05" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label><label>{t('Prerequisites')}<input value={prerequisites} onChange={(event) => setPrerequisites(event.target.value)} placeholder={t('Comma-separated dependencies')} /></label><label>{t('Steps')}<textarea rows={3} value={steps} onChange={(event) => setSteps(event.target.value)} placeholder={t('One practical step per line')} /></label><div className="form-actions"><button className="button ghost" onClick={() => makeTask.mutate()} disabled={makeTask.isPending}><ListTodo /> {t('Add to agenda')}</button><button className="button secondary" onClick={() => update.mutate()} disabled={update.isPending}><Save /> {t('Save plan')}</button></div></div>
      {(update.error || makeTask.error) && <ErrorState error={update.error || makeTask.error} />}
    </article>
  )
}

function TargetPortfolioPanel() {
  const { plural, t } = useI18n()
  const [selected, setSelected] = useState('')
  const targetSets = useQuery({ queryKey: ['target-sets'], queryFn: () => api<TargetSet[]>('/api/opportunities/target-sets') })
  const alignment = useQuery({ queryKey: ['target-alignment', selected], queryFn: () => api<{ score?: number; coverage: number; opportunity_count: number; matched_count: number; meaning: string }>(`/api/matches/target-sets/${selected}/alignment`), enabled: Boolean(selected) })
  const matrix = useQuery({ queryKey: ['target-recommendations', selected], queryFn: () => api<{ denominator: number; actions: Array<{ kind: string; title: string; opportunity_ids: string[]; max_priority: number; minimum_effort: number }>; meaning: string }>(`/api/matches/target-sets/${selected}/recommendations`), enabled: Boolean(selected) })
  return (
    <Panel title={t('Target portfolio alignment')} subtitle={t('A named scenario across the roles you selected, not a labor-market or hiring prediction')}>
      <label>{t('Portfolio scenario')}<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">{t('Choose a saved target portfolio')}</option>{targetSets.data?.map((item) => <option key={item.id} value={item.id}>{item.name} · {plural(item.opportunity_ids.length, '{count} role', '{count} roles')}</option>)}</select></label>
      {(targetSets.error || alignment.error || matrix.error) && <ErrorState error={targetSets.error || alignment.error || matrix.error} />}
      {alignment.data && <><div className="analytics-stats"><div><b>{alignment.data.score === undefined || alignment.data.score === null ? '–' : `${Math.round(alignment.data.score * 100)}%`}</b><span>{t('weighted alignment')}</span></div><div><b>{Math.round(alignment.data.coverage * 100)}%</b><span>{t('evidence coverage')}</span></div><div><b>{alignment.data.matched_count}/{alignment.data.opportunity_count}</b><span>{t('roles matched')}</span></div></div><p className="chart-warning">{t(alignment.data.meaning)}</p></>}
      {matrix.data?.actions.length ? <div className="target-action-matrix">{matrix.data.actions.map((item) => <article key={`${item.kind}-${item.title}`}><span className="status-badge">{t('{matched}/{total} roles', { matched: item.opportunity_ids.length, total: matrix.data.denominator })}</span><b>{localizedRecommendation(t, item)}</b><small>{t('Priority {priority} · minimum effort {effort}', { priority: Math.round(item.max_priority * 100), effort: Math.round(item.minimum_effort * 100) })}</small></article>)}</div> : selected && !matrix.isPending && <EmptyState title={t('No repeated gaps in this portfolio')} description={t('Generate role-level recommendations to populate the shared action matrix.')} />}
    </Panel>
  )
}

function MatchDetail({ run, opportunity }: { run: MatchRun; opportunity: Opportunity }) {
  const { formatDate, plural, t } = useI18n()
  const client = useQueryClient()
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: () => api<Recommendation[]>('/api/matches/recommendations/all') })
  const regenerate = useMutation({ mutationFn: () => api<Recommendation[]>(`/api/matches/${opportunity.id}/recommendations`, { method: 'POST' }), onSuccess: () => client.invalidateQueries({ queryKey: ['recommendations'] }) })
  const track = useMutation({ mutationFn: () => api('/api/pipeline/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunity_id: opportunity.id, channel: 'direct', notes: '' }) }), onSuccess: () => client.invalidateQueries({ queryKey: ['applications'] }) })
  const relevant = recommendations.data?.filter((item) => item.opportunity_id === opportunity.id) ?? []
  return (
    <div className="match-detail">
      <div className="match-hero"><div><span className="eyebrow"><Target /> {t('Match run {version}', { version: run.policy_version })}</span><h2>{opportunity.title}</h2><p>{opportunity.employer || t('Employer not specified')}</p></div><div className="hero-score"><Score value={run.score} /><small>{t('Evidence alignment')}</small></div><div className={`eligibility eligibility-${run.eligibility}`}><span>{t('Eligibility')}</span><b>{t(run.eligibility)}</b></div></div>
      <div className="match-facts"><div><b>{Math.round(run.coverage * 100)}%</b><span>{t('evidence coverage')}</span></div><div><b>{Math.round(run.lower_bound * 100)}–{Math.round(run.upper_bound * 100)}%</b><span>{t('uncertainty interval')}</span></div><div><b>{run.assessments.length}</b><span>{t('atomic requirements')}</span></div><div><b>{formatDate(run.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</b><span>{t('immutable snapshot')}</span></div></div>
      <SalaryBand compensation={opportunity.compensation as never} />
      <Panel title={t('Alignment shape')} subtitle={t('Known signals and uncertainty by requirement family')}><MatchWaterfall run={run} /></Panel>
      <Panel title={t('Evidence bridge')} subtitle={t('Every status traces requirements to current canonical evidence')}>
        <div className="assessment-list">{run.assessments.map((item) => <article key={item.requirement_id} className={`assessment ${item.status}`}><span className="assessment-icon">{statusIcon[item.status as keyof typeof statusIcon] ?? <CircleHelp />}</span><div><span className="status-badge">{t(item.importance)}</span><h3>{item.label}</h3><p>{localizedExplanation(t, item.explanation)}</p>{item.evidence_ids.length > 0 && <small>{plural(item.evidence_ids.length, '{count} confirmed evidence link', '{count} confirmed evidence links')}</small>}</div><strong>{item.score === null || item.score === undefined ? t('Unknown') : `${Math.round(item.score * 100)}%`}</strong></article>)}</div>
      </Panel>
      <Panel title={t('Opportunity-specific improvement')} subtitle={t('Actions generated from explicit gaps, not generic career advice')} actions={<button className="button secondary" onClick={() => regenerate.mutate()}><Lightbulb /> {t('Refresh actions')}</button>}>
        {(recommendations.error || regenerate.error || track.error) && <ErrorState error={recommendations.error || regenerate.error || track.error} />}
        {relevant.length ? <div className="recommendation-grid">{relevant.map((item) => <RecommendationCard key={item.id} item={item} />)}</div> : <EmptyState title={t('Generate an improvement plan')} description={t('CareerTwin will translate missing or partial requirements into transparent actions tied to this role.')} action={<button className="button primary" onClick={() => regenerate.mutate()}>{t('Generate recommendations')}</button>} />}
        <div className="match-cta"><div><Compass /><span><b>{t('Ready to make this actionable?')}</b><small>{t('Tracking belongs to you; CareerTwin never applies or sends outreach.')}</small></span></div><button className="button primary" onClick={() => track.mutate()} disabled={track.isSuccess}>{track.isSuccess ? t('Added to pipeline') : <>{t('Track application')} <ArrowRight /></>}</button></div>
      </Panel>
    </div>
  )
}

export function MatchesPage() {
  const { t } = useI18n()
  const client = useQueryClient()
  const [roleId, setRoleId] = useState<string>()
  const [portfoliosOpen, setPortfoliosOpen] = useState(false)
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api<MatchRun[]>('/api/matches') })
  // Warmed on mount: a requirement detail then opens with its evidence loaded.
  useClaims()
  const targetSets = useQuery({ queryKey: ['target-sets'], queryFn: () => api<TargetSet[]>('/api/opportunities/target-sets') })
  const runAll = useMutation({
    // Sequential on purpose: each run is an immutable record, and the server computes them
    // one at a time either way.
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await api<MatchRun>(`/api/matches/${id}/run`, { method: 'POST' })
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['matches'] }); client.invalidateQueries({ queryKey: ['today'] }) },
  })
  const latest = useMemo(() => { const result = new Map<string, MatchRun>(); for (const item of matches.data ?? []) if (!result.has(item.opportunity_id)) result.set(item.opportunity_id, item); return result }, [matches.data])
  if (opportunities.isPending || matches.isPending) return <Loading label={t('Preparing transparent comparisons')} />
  if (opportunities.error || matches.error) return <ErrorState error={opportunities.error || matches.error} />
  const unmatched = opportunities.data.filter((item) => !latest.has(item.id))
  const role = roleId ? opportunities.data.find((item) => item.id === roleId) : undefined
  const roleRun = roleId ? latest.get(roleId) : undefined
  return (
    <div className="page-contained workbench">
      <header className="workbench-bar">
        <h1>{t('Matches')}</h1>
        <p className="workbench-note">{t('Fit is evidence alignment, never a hiring probability.')}</p>
        {unmatched.length ? (
          <span className="workbench-alert">{t('{count} roles not matched yet', { count: unmatched.length })}</span>
        ) : null}
        {targetSets.data?.length ? (
          <button type="button" className="button ghost" onClick={() => setPortfoliosOpen(true)}><Target /> {t('Portfolios')}</button>
        ) : null}
        <button type="button" className="button primary" disabled={runAll.isPending} onClick={() => runAll.mutate(opportunities.data.map((item) => item.id))}>
          <Play /> {t(runAll.isPending ? 'Matching…' : 'Re-run matches')}
        </button>
      </header>
      {runAll.error ? <ErrorState error={runAll.error} /> : null}
      <CoverageWorkbench runs={matches.data ?? []} opportunities={opportunities.data ?? []} onOpenRole={setRoleId} />
      {role && roleRun ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRoleId(undefined)}>
          <section className="role-drawer" role="dialog" aria-modal="true" aria-label={role.title}>
            <button type="button" className="icon-button role-drawer-close" onClick={() => setRoleId(undefined)} aria-label={t('Close')}><X /></button>
            <MatchDetail run={roleRun} opportunity={role} />
          </section>
        </div>
      ) : null}
      {portfoliosOpen ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPortfoliosOpen(false)}>
          <section className="portfolio-modal" role="dialog" aria-modal="true" aria-label={t('Target portfolio alignment')}>
            <button type="button" className="icon-button portfolio-modal-close" onClick={() => setPortfoliosOpen(false)} aria-label={t('Close')}><X /></button>
            <TargetPortfolioPanel />
          </section>
        </div>
      ) : null}
    </div>
  )
}
