import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, CircleOff, Compass, Gauge, Lightbulb, ListTodo, Play, Save, ShieldQuestion, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api, json } from '../api'
import { MatchWaterfall } from '../components/Visualizations'
import { EmptyState, ErrorState, Loading, PageHeader, Panel, Score } from '../components/Primitives'
import type { MatchRun, Opportunity, Recommendation, TargetSet } from '../types'

const statusIcon = {
  met: <CheckCircle2 />, partial: <CircleHelp />, missing: <CircleOff />, unknown: <ShieldQuestion />, conflict: <AlertTriangle />,
} as const

function RecommendationCard({ item }: { item: Recommendation }) {
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
    <article><header><span className="status-badge">{item.kind}</span><b>Priority {Math.round(item.priority * 100)}</b></header><h3>{item.title}</h3><p>{item.rationale}</p><div><span>Impact <i style={{ width: `${item.impact * 100}%` }} /></span><span>Effort <i style={{ width: `${item.effort * 100}%` }} /></span></div>
      <div className="recommendation-plan"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>suggested</option><option>planned</option><option>doing</option><option>completed</option><option>dismissed</option></select></label><label>Progress <b>{Math.round(progress * 100)}%</b><input type="range" min="0" max="1" step="0.05" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label><label>Prerequisites<input value={prerequisites} onChange={(event) => setPrerequisites(event.target.value)} placeholder="Comma-separated dependencies" /></label><label>Steps<textarea rows={3} value={steps} onChange={(event) => setSteps(event.target.value)} placeholder="One practical step per line" /></label><div className="form-actions"><button className="button ghost" onClick={() => makeTask.mutate()} disabled={makeTask.isPending}><ListTodo /> Add to agenda</button><button className="button secondary" onClick={() => update.mutate()} disabled={update.isPending}><Save /> Save plan</button></div></div>
      {(update.error || makeTask.error) && <ErrorState error={update.error || makeTask.error} />}
    </article>
  )
}

function TargetPortfolioPanel() {
  const [selected, setSelected] = useState('')
  const targetSets = useQuery({ queryKey: ['target-sets'], queryFn: () => api<TargetSet[]>('/api/opportunities/target-sets') })
  const alignment = useQuery({ queryKey: ['target-alignment', selected], queryFn: () => api<{ score?: number; coverage: number; opportunity_count: number; matched_count: number; meaning: string }>(`/api/matches/target-sets/${selected}/alignment`), enabled: Boolean(selected) })
  const matrix = useQuery({ queryKey: ['target-recommendations', selected], queryFn: () => api<{ denominator: number; actions: Array<{ kind: string; title: string; opportunity_ids: string[]; max_priority: number; minimum_effort: number }>; meaning: string }>(`/api/matches/target-sets/${selected}/recommendations`), enabled: Boolean(selected) })
  return (
    <Panel title="Target portfolio alignment" subtitle="A named scenario across the roles you selected—not a labor-market or hiring prediction">
      <label>Portfolio scenario<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose a saved target portfolio</option>{targetSets.data?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.opportunity_ids.length} roles</option>)}</select></label>
      {(targetSets.error || alignment.error || matrix.error) && <ErrorState error={targetSets.error || alignment.error || matrix.error} />}
      {alignment.data && <><div className="analytics-stats"><div><b>{alignment.data.score === undefined || alignment.data.score === null ? '—' : `${Math.round(alignment.data.score * 100)}%`}</b><span>weighted alignment</span></div><div><b>{Math.round(alignment.data.coverage * 100)}%</b><span>evidence coverage</span></div><div><b>{alignment.data.matched_count}/{alignment.data.opportunity_count}</b><span>roles matched</span></div></div><p className="chart-warning">{alignment.data.meaning}</p></>}
      {matrix.data?.actions.length ? <div className="target-action-matrix">{matrix.data.actions.map((item) => <article key={`${item.kind}-${item.title}`}><span className="status-badge">{item.opportunity_ids.length}/{matrix.data.denominator} roles</span><b>{item.title}</b><small>Priority {Math.round(item.max_priority * 100)} · minimum effort {Math.round(item.minimum_effort * 100)}</small></article>)}</div> : selected && !matrix.isPending && <EmptyState title="No repeated gaps in this portfolio" description="Generate role-level recommendations to populate the shared action matrix." />}
    </Panel>
  )
}

function MatchDetail({ run, opportunity }: { run: MatchRun; opportunity: Opportunity }) {
  const client = useQueryClient()
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: () => api<Recommendation[]>('/api/matches/recommendations/all') })
  const regenerate = useMutation({ mutationFn: () => api<Recommendation[]>(`/api/matches/${opportunity.id}/recommendations`, { method: 'POST' }), onSuccess: () => client.invalidateQueries({ queryKey: ['recommendations'] }) })
  const track = useMutation({ mutationFn: () => api('/api/pipeline/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunity_id: opportunity.id, channel: 'direct', notes: '' }) }), onSuccess: () => client.invalidateQueries({ queryKey: ['applications'] }) })
  const relevant = recommendations.data?.filter((item) => item.opportunity_id === opportunity.id) ?? []
  return (
    <div className="match-detail">
      <div className="match-hero"><div><span className="eyebrow"><Target /> Match run {run.policy_version}</span><h2>{opportunity.title}</h2><p>{opportunity.employer || 'Employer not specified'}</p></div><div className="hero-score"><Score value={run.score} /><small>Evidence alignment</small></div><div className={`eligibility eligibility-${run.eligibility}`}><span>Eligibility</span><b>{run.eligibility}</b></div></div>
      <div className="match-facts"><div><b>{Math.round(run.coverage * 100)}%</b><span>evidence coverage</span></div><div><b>{Math.round(run.lower_bound * 100)}–{Math.round(run.upper_bound * 100)}%</b><span>uncertainty interval</span></div><div><b>{run.assessments.length}</b><span>atomic requirements</span></div><div><b>{new Date(run.created_at).toLocaleString()}</b><span>immutable snapshot</span></div></div>
      <Panel title="Alignment shape" subtitle="Known signals and uncertainty by requirement family"><MatchWaterfall run={run} /></Panel>
      <Panel title="Evidence bridge" subtitle="Every status traces requirements to current canonical evidence">
        <div className="assessment-list">{run.assessments.map((item) => <article key={item.requirement_id} className={`assessment ${item.status}`}><span className="assessment-icon">{statusIcon[item.status as keyof typeof statusIcon] ?? <CircleHelp />}</span><div><span className="status-badge">{item.importance}</span><h3>{item.label}</h3><p>{item.explanation}</p>{item.evidence_ids.length > 0 && <small>{item.evidence_ids.length} confirmed evidence link{item.evidence_ids.length === 1 ? '' : 's'}</small>}</div><strong>{item.score === null || item.score === undefined ? 'Unknown' : `${Math.round(item.score * 100)}%`}</strong></article>)}</div>
      </Panel>
      <Panel title="Opportunity-specific improvement" subtitle="Actions generated from explicit gaps—not generic career advice" actions={<button className="button secondary" onClick={() => regenerate.mutate()}><Lightbulb /> Refresh actions</button>}>
        {(recommendations.error || regenerate.error || track.error) && <ErrorState error={recommendations.error || regenerate.error || track.error} />}
        {relevant.length ? <div className="recommendation-grid">{relevant.map((item) => <RecommendationCard key={item.id} item={item} />)}</div> : <EmptyState title="Generate an improvement plan" description="CareerTwin will translate missing or partial requirements into transparent actions tied to this role." action={<button className="button primary" onClick={() => regenerate.mutate()}>Generate recommendations</button>} />}
        <div className="match-cta"><div><Compass /><span><b>Ready to make this actionable?</b><small>Tracking belongs to you; CareerTwin never applies or sends outreach.</small></span></div><button className="button primary" onClick={() => track.mutate()} disabled={track.isSuccess}>{track.isSuccess ? 'Added to pipeline' : <>Track application <ArrowRight /></>}</button></div>
      </Panel>
    </div>
  )
}

export function MatchesPage() {
  const client = useQueryClient()
  const [selectedId, setSelectedId] = useState<string>()
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api<MatchRun[]>('/api/matches') })
  const run = useMutation({ mutationFn: (opportunityId: string) => api<MatchRun>(`/api/matches/${opportunityId}/run`, { method: 'POST' }), onSuccess: (value) => { setSelectedId(value.opportunity_id); client.invalidateQueries({ queryKey: ['matches'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  const latest = useMemo(() => { const result = new Map<string, MatchRun>(); for (const item of matches.data ?? []) if (!result.has(item.opportunity_id)) result.set(item.opportunity_id, item); return result }, [matches.data])
  if (opportunities.isPending || matches.isPending) return <Loading label="Preparing transparent comparisons" />
  if (opportunities.error || matches.error) return <ErrorState error={opportunities.error || matches.error} />
  const selectedRun = selectedId ? latest.get(selectedId) : undefined
  const selectedOpportunity = opportunities.data.find((item) => item.id === selectedId)
  return (
    <>
      <PageHeader eyebrow="Evidence alignment" title="Compare requirements without pretending to predict hiring." description="A deterministic, versioned score with separate eligibility, explicit evidence coverage, and a visible uncertainty interval." />
      <TargetPortfolioPanel />
      <div className="match-layout">
        <aside className="match-index"><div className="match-index-head"><h2>Saved roles</h2><span>{opportunities.data.length}</span></div>{opportunities.data.length ? opportunities.data.map((opportunity) => { const value = latest.get(opportunity.id); return <article key={opportunity.id} className={selectedId === opportunity.id ? 'selected' : ''}><button onClick={() => setSelectedId(opportunity.id)}><span className="company-mark"><Target /></span><div><b>{opportunity.title}</b><small>{opportunity.employer || 'Employer unknown'}</small></div>{value ? <Score value={value.score} /> : <span className="unscored">Not run</span>}</button><footer>{value ? <><span>{Math.round(value.coverage * 100)}% covered</span><span className={`eligibility-${value.eligibility}`}>{value.eligibility}</span></> : <span>Add or confirm evidence first</span>}<button className="text-button" onClick={() => run.mutate(opportunity.id)}><Play /> {value ? 'Re-run' : 'Run'}</button></footer></article> }) : <EmptyState title="No roles to compare" description="Capture opportunities before running evidence alignment." />}</aside>
        <section>{run.error && <ErrorState error={run.error} />}{selectedRun && selectedOpportunity ? <MatchDetail run={selectedRun} opportunity={selectedOpportunity} /> : <div className="match-empty"><div className="radar-illustration"><Gauge /><i /><i /><i /></div><h2>Select a role and run matching</h2><p>The engine will separate hard eligibility from weighted fit, cite current evidence, and preserve unknowns instead of silently treating them as failure.</p><div className="principle-grid"><span><ShieldQuestion /><b>Unknown ≠ weak</b><small>Missing evidence widens uncertainty.</small></span><span><TrendingUp /><b>Versioned policy</b><small>Same inputs produce the same result.</small></span><span><Target /><b>No hiring prediction</b><small>Alignment supports your decision.</small></span></div></div>}</section>
      </div>
    </>
  )
}
