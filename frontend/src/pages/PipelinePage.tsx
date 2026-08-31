import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Check, ChevronRight, Clock3, ContactRound, Download, FileUp, KanbanSquare, Link2, ListChecks, Plus, TimerReset, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { api, json } from '../api'
import { ConnectionsPanel } from '../components/ConnectionsPanel'
import { EmptyState, ErrorState, Loading, PageHeader, Panel } from '../components/Primitives'
import { useI18n } from '../i18n'
import type { Application, CareerTask, Contact, Opportunity, PipelineAnalytics } from '../types'

const stages = ['saved', 'preparing', 'applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn'] as const
const transitions: Record<string, string[]> = {
  saved: ['preparing', 'withdrawn'],
  preparing: ['saved', 'applied', 'withdrawn'],
  applied: ['screening', 'interview', 'rejected', 'withdrawn'],
  screening: ['interview', 'offer', 'rejected', 'withdrawn'],
  interview: ['interview', 'offer', 'rejected', 'withdrawn'],
  offer: ['accepted', 'rejected', 'withdrawn'],
  accepted: [],
  rejected: [],
  withdrawn: [],
}

function PipelineCard({ application, opportunity }: { application: Application; opportunity?: Opportunity }) {
  const { formatDate, t } = useI18n()
  const client = useQueryClient()
  const nextStages = transitions[application.stage] ?? []
  const change = useMutation({
    mutationFn: (stage: string) => api(`/api/pipeline/applications/${application.id}/stage`, json('POST', { stage, note: 'Moved in CareerTwin pipeline' })),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['applications'] })
      client.invalidateQueries({ queryKey: ['analytics'] })
      client.invalidateQueries({ queryKey: ['today'] })
    },
  })
  return (
    <article className="pipeline-card">
      <span className="card-channel">{t(application.channel)}</span>
      <h3>{opportunity?.title ?? t('Opportunity removed')}</h3>
      <p>{opportunity?.employer || t('Employer not specified')}</p>
      {application.notes && <small>{application.notes}</small>}
      <footer>
        {nextStages.length ? <label>{t('Move to')}<select aria-label={t('Move {title} to stage', { title: opportunity?.title ?? '' })} defaultValue="" onChange={(event) => event.target.value && change.mutate(event.target.value)}><option value="" disabled>{t('Choose next stage')}</option>{nextStages.map((stage) => <option key={stage} value={stage}>{t(stage)}</option>)}</select></label> : <span className="status-badge">{t('Closed state')}</span>}
        <small>{formatDate(application.updated_at)}</small>
      </footer>
      {change.error && <ErrorState error={change.error} />}
    </article>
  )
}

function TaskComposer({ applications, contacts }: { applications: Application[]; contacts: Contact[] }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('task')
  const [dueAt, setDueAt] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [contactId, setContactId] = useState('')
  const create = useMutation({
    mutationFn: () => api('/api/pipeline/tasks', json('POST', {
      title,
      kind,
      application_id: applicationId || null,
      contact_id: contactId || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      notes: '',
      contact: {},
    })),
    onSuccess: () => {
      setOpen(false)
      setTitle('')
      setDueAt('')
      setContactId('')
      client.invalidateQueries({ queryKey: ['tasks'] })
      client.invalidateQueries({ queryKey: ['today'] })
    },
  })
  const compatibleContacts = contacts.filter((item) => !applicationId || !item.application_id || item.application_id === applicationId)
  if (!open) return <button className="button primary" onClick={() => setOpen(true)}><Plus /> {t('Add task or meeting')}</button>
  return (
    <form className="task-composer" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
      <select value={kind} onChange={(event) => setKind(event.target.value)}>{['task', 'deadline', 'meeting', 'reminder'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>
      <input placeholder={t('What needs to happen?')} value={title} onChange={(event) => setTitle(event.target.value)} required />
      <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      <select value={applicationId} onChange={(event) => { setApplicationId(event.target.value); setContactId('') }}><option value="">{t('General career task')}</option>{applications.map((item) => <option value={item.id} key={item.id}>{t('Application {id}', { id: item.id.slice(0, 8) })}</option>)}</select>
      <select aria-label={t('Associated contact')} value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">{t('No associated contact')}</option>{compatibleContacts.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.organization}</option>)}</select>
      <button className="button primary"><Check /> {t('Add')}</button>
      <button type="button" className="button ghost" onClick={() => setOpen(false)}>{t('Cancel')}</button>
      {create.error && <ErrorState error={create.error} />}
    </form>
  )
}

function TaskList({ tasks }: { tasks: CareerTask[] }) {
  const { formatDate, t } = useI18n()
  const client = useQueryClient()
  const complete = useMutation({
    mutationFn: (id: string) => api(`/api/pipeline/tasks/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['tasks'] })
      client.invalidateQueries({ queryKey: ['today'] })
    },
  })
  return tasks.length ? (
    <div className="agenda-list">{tasks.map((task) => <article key={task.id} className={task.completed_at ? 'completed' : ''}><span className={`task-kind kind-${task.kind}`}>{task.kind === 'meeting' ? <CalendarDays /> : <Clock3 />}</span><div><small>{t(task.kind)} · {(task.starts_at ?? task.due_at) ? formatDate(task.starts_at ?? task.due_at ?? '', { dateStyle: 'medium', timeStyle: 'short' }) : t('Not scheduled')}</small><h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}</div>{task.completed_at ? <span className="status-badge confirmed"><Check /> {t('Done')}</span> : <button className="button ghost" onClick={() => complete.mutate(task.id)}><Check /> {t('Complete')}</button>}</article>)}</div>
  ) : <EmptyState title={t('No tasks or meetings')} description={t('Add your next action, deadline, reminder, or conversation so it stays connected to the search.')} />
}

function ContactsPanel({ contacts, applications }: { contacts: Contact[]; applications: Application[] }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const create = useMutation({
    mutationFn: () => api('/api/pipeline/contacts', json('POST', { name, email: email || null, organization, role, application_id: applicationId || null, notes: '' })),
    onSuccess: () => {
      setName('')
      setEmail('')
      setOrganization('')
      setRole('')
      setApplicationId('')
      client.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/pipeline/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['contacts'] })
      client.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  return (
    <Panel title={t('People and conversations')} subtitle={t('Keep recruiter and network context attached to your own application timeline')}>
      <form className="contact-composer" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Contact name')} required />
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('Email (optional)')} />
        <input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder={t('Organization')} />
        <input value={role} onChange={(event) => setRole(event.target.value)} placeholder={t('Role')} />
        <select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}><option value="">{t('General network contact')}</option>{applications.map((item) => <option value={item.id} key={item.id}>{t('Application {id}', { id: item.id.slice(0, 8) })}</option>)}</select>
        <button className="button secondary"><Plus /> {t('Add contact')}</button>
      </form>
      {(create.error || remove.error) && <ErrorState error={create.error || remove.error} />}
      {contacts.length ? <div className="contact-list">{contacts.map((item) => <article key={item.id}><span><ContactRound /></span><div><b>{item.name}</b><small>{[item.role, item.organization, item.email].filter(Boolean).join(' · ')}</small></div><button className="icon-button" aria-label={t('Delete {name}', { name: item.name })} onClick={() => remove.mutate(item.id)}><Trash2 /></button></article>)}</div> : <EmptyState title={t('No contacts yet')} description={t('Add a recruiter, hiring manager, mentor, or networking contact.')} />}
    </Panel>
  )
}

function CalendarImport() {
  const { t } = useI18n()
  const client = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<{ created: number; skipped: number }>('/api/pipeline/calendar/import', { method: 'POST', body: form })
    },
    onSuccess: (result) => {
      setNotice(t('{created} imported, {skipped} already present', { created: result.created, skipped: result.skipped }))
      client.invalidateQueries({ queryKey: ['tasks'] })
      client.invalidateQueries({ queryKey: ['today'] })
    },
  })
  return <div className="calendar-import"><input ref={fileRef} hidden type="file" accept="text/calendar,.ics" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button className="button secondary" onClick={() => fileRef.current?.click()}><FileUp /> {t('Import calendar')}</button>{notice && <span>{notice}</span>}{upload.error && <ErrorState error={upload.error} />}</div>
}

export function PipelinePage() {
  const { plural, t } = useI18n()
  const [view, setView] = useState<'board' | 'agenda' | 'analytics' | 'connections'>('board')
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/api/pipeline/applications') })
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<CareerTask[]>('/api/pipeline/tasks') })
  const contacts = useQuery({ queryKey: ['contacts'], queryFn: () => api<Contact[]>('/api/pipeline/contacts') })
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const analytics = useQuery({ queryKey: ['analytics'], queryFn: () => api<PipelineAnalytics>('/api/pipeline/analytics') })
  const opportunityMap = useMemo(() => new Map((opportunities.data ?? []).map((item) => [item.id, item])), [opportunities.data])
  if (applications.isPending || tasks.isPending || contacts.isPending || opportunities.isPending || analytics.isPending) return <Loading label={t('Assembling your candidate-owned pipeline')} />
  const error = applications.error || tasks.error || contacts.error || opportunities.error || analytics.error
  if (error) return <ErrorState error={error} />
  return (
    <>
      <PageHeader eyebrow={t('Application operations')} title={t('Keep every thread moving on your terms.')} description={t('Track roles, legal stage transitions, deadlines, meetings, follow-ups, and personal process signals—without automated applications or outreach.')} actions={<TaskComposer applications={applications.data} contacts={contacts.data} />} />
      <div className="list-toolbar"><div className="segmented"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><KanbanSquare /> {t('Board')}</button><button className={view === 'agenda' ? 'active' : ''} onClick={() => setView('agenda')}><ListChecks /> {t('Agenda')}</button><button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}><BarChart3 /> {t('Process signals')}</button><button className={view === 'connections' ? 'active' : ''} onClick={() => setView('connections')}><Link2 /> {t('Connections')}</button></div><div className="form-actions"><CalendarImport /><a className="button secondary" href="/api/pipeline/calendar.ics"><Download /> {t('Export calendar')}</a></div></div>
      {view === 'board' && (applications.data.length ? <div className="pipeline-board">{stages.map((stage) => { const items = applications.data.filter((item) => item.stage === stage); return <section className={`pipeline-column stage-${stage}`} key={stage}><header><span>{t(stage)}</span><b>{items.length}</b></header><div>{items.map((item) => <PipelineCard key={item.id} application={item} opportunity={opportunityMap.get(item.opportunity_id)} />)}{!items.length && <span className="column-empty">{t('No applications')}</span>}</div></section> })}</div> : <EmptyState title={t('Your pipeline has room for a first role')} description={t('Run a match for a saved opportunity, then choose Track application. CareerTwin will preserve the stage history.')} />)}
      {view === 'agenda' && <div className="agenda-layout"><Panel title={t('Your career agenda')} subtitle={t('Meetings, deadlines, reminders, and next actions')}><TaskList tasks={tasks.data} /></Panel><Panel title={t('Time horizon')} subtitle={t('Upcoming work grouped by urgency')}><div className="horizon">{[['Next 7 days', 7], ['Next 30 days', 30], ['Later / unscheduled', Infinity]].map(([label, days], index) => { const previous = index === 0 ? 0 : Number([['', 7], ['', 30]][index - 1]?.[1] ?? 0); const count = tasks.data.filter((task) => { if (!task.due_at || task.completed_at) return days === Infinity; const delta = (new Date(task.due_at).getTime() - Date.now()) / 86400000; return delta <= Number(days) && delta > previous }).length; return <div key={String(label)}><span><TimerReset /></span><b>{count}</b><small>{t(String(label))}</small></div> })}</div></Panel><ContactsPanel contacts={contacts.data} applications={applications.data} /></div>}
      {view === 'analytics' && <div className="analytics-layout"><section className="funnel-visual">{stages.slice(0, 7).map((stage, index) => { const count = analytics.data.by_stage[stage] ?? 0; const width = Math.max(22, 100 - index * 10); return <div key={stage} style={{ width: `${width}%` }}><span>{t(stage)}</span><b>{count}</b><ChevronRight /></div> })}</section><Panel title={t('Personal process signals')} subtitle={plural(analytics.data.denominator, 'Based on {count} tracked application', 'Based on {count} tracked applications')}><div className="analytics-stats"><div><b>{analytics.data.applied_count}</b><span>{t('applications sent')}</span></div><div><b>{analytics.data.median_days_to_close === undefined || analytics.data.median_days_to_close === null ? '—' : Math.round(analytics.data.median_days_to_close)}</b><span>{t('median days to close')}</span></div></div>{analytics.data.sample_warning && <div className="sample-warning">{t('Small sample: treat patterns as descriptive, not predictive.')}</div>}<p className="chart-warning">{t(analytics.data.meaning)}</p></Panel></div>}
      {view === 'connections' && <ConnectionsPanel />}
    </>
  )
}
