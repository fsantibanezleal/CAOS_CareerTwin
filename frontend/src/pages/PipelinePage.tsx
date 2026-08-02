import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Check, ChevronRight, Clock3, Download, KanbanSquare, ListChecks, Plus, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api, json } from '../api'
import { EmptyState, ErrorState, Loading, PageHeader, Panel } from '../components/Primitives'
import type { Application, CareerTask, Opportunity, PipelineAnalytics } from '../types'

const stages = ['saved', 'preparing', 'applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn'] as const
const transitions: Record<string, string[]> = {
  saved: ['preparing', 'withdrawn'], preparing: ['saved', 'applied', 'withdrawn'], applied: ['screening', 'interview', 'rejected', 'withdrawn'], screening: ['interview', 'offer', 'rejected', 'withdrawn'], interview: ['interview', 'offer', 'rejected', 'withdrawn'], offer: ['accepted', 'rejected', 'withdrawn'], accepted: [], rejected: [], withdrawn: [],
}

function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Not scheduled'
}

function PipelineCard({ application, opportunity }: { application: Application; opportunity?: Opportunity }) {
  const client = useQueryClient()
  const nextStages = transitions[application.stage] ?? []
  const change = useMutation({ mutationFn: (stage: string) => api(`/api/pipeline/applications/${application.id}/stage`, json('POST', { stage, note: 'Moved in CareerTwin pipeline' })), onSuccess: () => { client.invalidateQueries({ queryKey: ['applications'] }); client.invalidateQueries({ queryKey: ['analytics'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  return (
    <article className="pipeline-card"><span className="card-channel">{application.channel}</span><h3>{opportunity?.title ?? 'Opportunity removed'}</h3><p>{opportunity?.employer || 'Employer not specified'}</p>{application.notes && <small>{application.notes}</small>}<footer>{nextStages.length ? <label>Move to<select aria-label={`Move ${opportunity?.title} to stage`} defaultValue="" onChange={(event) => event.target.value && change.mutate(event.target.value)}><option value="" disabled>Choose next stage</option>{nextStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label> : <span className="status-badge">Closed state</span>}<small>{new Date(application.updated_at).toLocaleDateString()}</small></footer>{change.error && <ErrorState error={change.error} />}</article>
  )
}

function TaskComposer({ applications }: { applications: Application[] }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('task')
  const [dueAt, setDueAt] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const create = useMutation({ mutationFn: () => api('/api/pipeline/tasks', json('POST', { title, kind, application_id: applicationId || null, due_at: dueAt ? new Date(dueAt).toISOString() : null, notes: '', contact: {} })), onSuccess: () => { setOpen(false); setTitle(''); setDueAt(''); client.invalidateQueries({ queryKey: ['tasks'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  return <>{open ? <form className="task-composer" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><select value={kind} onChange={(event) => setKind(event.target.value)}><option>task</option><option>deadline</option><option>meeting</option><option>reminder</option></select><input placeholder="What needs to happen?" value={title} onChange={(event) => setTitle(event.target.value)} required /><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}><option value="">General career task</option>{applications.map((item) => <option value={item.id} key={item.id}>Application {item.id.slice(0, 8)}</option>)}</select><button className="button primary"><Check /> Add</button><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button>{create.error && <ErrorState error={create.error} />}</form> : <button className="button primary" onClick={() => setOpen(true)}><Plus /> Add task or meeting</button>}</>
}

function TaskList({ tasks }: { tasks: CareerTask[] }) {
  const client = useQueryClient()
  const complete = useMutation({ mutationFn: (id: string) => api(`/api/pipeline/tasks/${id}/complete`, { method: 'POST' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['tasks'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  return tasks.length ? <div className="agenda-list">{tasks.map((task) => <article key={task.id} className={task.completed_at ? 'completed' : ''}><span className={`task-kind kind-${task.kind}`}>{task.kind === 'meeting' ? <CalendarDays /> : <Clock3 />}</span><div><small>{task.kind} · {dateLabel(task.starts_at ?? task.due_at)}</small><h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}</div>{task.completed_at ? <span className="status-badge confirmed"><Check /> Done</span> : <button className="button ghost" onClick={() => complete.mutate(task.id)}><Check /> Complete</button>}</article>)}</div> : <EmptyState title="No tasks or meetings" description="Add your next action, deadline, reminder, or conversation so it stays connected to the search." />
}

export function PipelinePage() {
  const [view, setView] = useState<'board' | 'agenda' | 'analytics'>('board')
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/api/pipeline/applications') })
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<CareerTask[]>('/api/pipeline/tasks') })
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const analytics = useQuery({ queryKey: ['analytics'], queryFn: () => api<PipelineAnalytics>('/api/pipeline/analytics') })
  const opportunityMap = useMemo(() => new Map((opportunities.data ?? []).map((item) => [item.id, item])), [opportunities.data])
  if (applications.isPending || tasks.isPending || opportunities.isPending || analytics.isPending) return <Loading label="Assembling your candidate-owned pipeline" />
  const error = applications.error || tasks.error || opportunities.error || analytics.error
  if (error) return <ErrorState error={error} />
  return (
    <>
      <PageHeader eyebrow="Application operations" title="Keep every thread moving on your terms." description="Track roles, legal stage transitions, deadlines, meetings, follow-ups, and personal process signals—without automated applications or outreach." actions={<TaskComposer applications={applications.data} />} />
      <div className="list-toolbar"><div className="segmented"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><KanbanSquare /> Board</button><button className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}><ListChecks /> Agenda</button><button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}><BarChart3 /> Process signals</button></div><a className="button secondary" href="/api/pipeline/calendar.ics"><Download /> Export calendar</a></div>
      {view === 'board' && (applications.data.length ? <div className="pipeline-board">{stages.map((stage) => { const items = applications.data.filter((item) => item.stage === stage); return <section className={`pipeline-column stage-${stage}`} key={stage}><header><span>{stage}</span><b>{items.length}</b></header><div>{items.map((item) => <PipelineCard key={item.id} application={item} opportunity={opportunityMap.get(item.opportunity_id)} />)}{!items.length && <span className="column-empty">No applications</span>}</div></section> })}</div> : <EmptyState title="Your pipeline has room for a first role" description="Run a match for a saved opportunity, then choose Track application. CareerTwin will preserve the stage history." />)}
      {view === 'agenda' && <div className="agenda-layout"><Panel title="Your career agenda" subtitle="Meetings, deadlines, reminders, and next actions"><TaskList tasks={tasks.data} /></Panel><Panel title="Time horizon" subtitle="Upcoming work grouped by urgency"><div className="horizon">{[['Next 7 days', 7], ['Next 30 days', 30], ['Later / unscheduled', Infinity]].map(([label, days], index) => { const previous = index === 0 ? 0 : Number([['', 7], ['', 30]][index - 1]?.[1] ?? 0); const count = tasks.data.filter((task) => { if (!task.due_at || task.completed_at) return days === Infinity; const delta = (new Date(task.due_at).getTime() - Date.now()) / 86400000; return delta <= Number(days) && delta > previous }).length; return <div key={String(label)}><span><TimerReset /></span><b>{count}</b><small>{label}</small></div> })}</div></Panel></div>}
      {view === 'analytics' && <div className="analytics-layout"><section className="funnel-visual">{stages.slice(0, 7).map((stage, index) => { const count = analytics.data.by_stage[stage] ?? 0; const width = Math.max(22, 100 - index * 10); return <div key={stage} style={{ width: `${width}%` }}><span>{stage}</span><b>{count}</b><ChevronRight /></div> })}</section><Panel title="Personal process signals" subtitle={`Based on ${analytics.data.denominator} tracked application${analytics.data.denominator === 1 ? '' : 's'}`}><div className="analytics-stats"><div><b>{analytics.data.applied_count}</b><span>applications sent</span></div><div><b>{analytics.data.median_days_to_close === undefined || analytics.data.median_days_to_close === null ? '—' : Math.round(analytics.data.median_days_to_close)}</b><span>median days to close</span></div></div>{analytics.data.sample_warning && <div className="sample-warning">Small sample: treat patterns as descriptive, not predictive.</div>}<p className="chart-warning">{analytics.data.meaning}</p></Panel></div>}
    </>
  )
}
