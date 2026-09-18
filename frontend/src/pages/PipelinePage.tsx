import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileUp, Info, KanbanSquare, Link2, Plus, Users } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../api'
import { ApplicationDetail } from '../components/ApplicationDetail'
import { CareerCalendar } from '../components/CareerCalendar'
import { ConnectionsPanel } from '../components/ConnectionsPanel'
import { PeopleWorkbench } from '../components/PeopleWorkbench'
import { ContactDialog, TaskDialog } from '../components/PipelineDialogs'
import { PipelineJourneys } from '../components/PipelineJourneys'
import { EmptyState, ErrorState, Loading } from '../components/Primitives'
import { useI18n } from '../i18n'
import { buildJourneys } from '../pipeline'
import type { Application, CareerTask, Contact, MatchRun, Opportunity, PipelineAnalytics, StageEvent } from '../types'
import { useJourneyView } from '../useJourneyView'

/**
 * The application pipeline, as a workbench: see docs/design/pipeline-workbench-adr-0071.md.
 */

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
  return (
    <span className="calendar-import">
      <input ref={fileRef} hidden type="file" accept="text/calendar,.ics" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} />
      <button type="button" className="ob-action" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
        <FileUp aria-hidden /> {t('Import')}
      </button>
      {notice ? <small className="calendar-notice">{notice}</small> : null}
      {upload.error ? <ErrorState error={upload.error} /> : null}
    </span>
  )
}

type View = 'board' | 'calendar' | 'people' | 'connections'
type DialogState = { kind: 'task' | 'contact'; applicationId?: string } | null

export function PipelinePage() {
  const { plural, t } = useI18n()
  const [view, setView] = useState<View>('board')
  // `?application=<id>` opens an application directly, as Today's links do.
  const [params] = useSearchParams()
  const linked = params.get('application') ?? undefined
  const [selectedId, setSelectedId] = useState<string | undefined>(linked)
  const [dialog, setDialog] = useState<DialogState>(null)
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/api/pipeline/applications') })
  const events = useQuery({ queryKey: ['pipeline-events'], queryFn: () => api<StageEvent[]>('/api/pipeline/events') })
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<CareerTask[]>('/api/pipeline/tasks') })
  const contacts = useQuery({ queryKey: ['contacts'], queryFn: () => api<Contact[]>('/api/pipeline/contacts') })
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const analytics = useQuery({ queryKey: ['analytics'], queryFn: () => api<PipelineAnalytics>('/api/pipeline/analytics') })
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api<MatchRun[]>('/api/matches') })
  const opportunityMap = useMemo(() => new Map((opportunities.data ?? []).map((item) => [item.id, item])), [opportunities.data])
  const latestRun = useMemo(() => {
    const out = new Map<string, MatchRun>()
    for (const run of matches.data ?? []) if (!out.has(run.opportunity_id)) out.set(run.opportunity_id, run)
    return out
  }, [matches.data])
  const journeys = useMemo(
    () => buildJourneys(applications.data ?? [], events.data ?? [], opportunityMap, latestRun),
    [applications.data, events.data, opportunityMap, latestRun],
  )
  const journeyView = useJourneyView(journeys)

  const queries = [applications, events, tasks, contacts, opportunities, analytics, matches]
  if (queries.some((query) => query.isPending)) return <Loading label={t('Assembling your candidate-owned pipeline')} />
  const error = queries.find((query) => query.error)?.error
  if (error || !applications.data || !events.data || !tasks.data || !contacts.data || !analytics.data) return <ErrorState error={error} />

  // A linked application shows even when the board's filters would hide it, closed ones included.
  const selected =
    journeyView.visible.find((journey) => journey.application.id === selectedId) ??
    (selectedId && selectedId === linked ? journeys.find((journey) => journey.application.id === selectedId) : undefined) ??
    journeyView.visible[0]
  // Opening an application from the calendar or people view lands on it in the board, even when
  // the board's filters would hide it.
  const openApplication = (id: string) => {
    const journey = journeys.find((item) => item.application.id === id)
    if (journey?.closed) journeyView.setShowClosed(true)
    if (journey && journeyView.stage && journeyView.stage !== journey.application.stage) journeyView.setStage(null)
    setSelectedId(id)
    setView('board')
  }
  const stats = analytics.data
  const caveat = [t(stats.meaning), stats.sample_warning ? t('Small sample: treat patterns as descriptive, not predictive.') : null].filter(Boolean).join(' ')
  const summary = (
    <span title={caveat}>
      {[
        plural(stats.denominator, '{count} tracked', '{count} tracked'),
        plural(stats.applied_count, '{count} application sent', '{count} applications sent'),
        stats.median_days_to_close != null ? t('median {days} days to close', { days: Math.round(stats.median_days_to_close) }) : null,
      ]
        .filter(Boolean)
        .join(' \u00b7 ')}
      <Info role="img" aria-label={caveat} />
    </span>
  )
  const views: Array<[View, string, ReactNode]> = [
    ['board', t('Board'), <KanbanSquare aria-hidden />],
    ['calendar', t('Calendar'), <CalendarDays aria-hidden />],
    ['people', t('People'), <Users aria-hidden />],
    ['connections', t('Connections'), <Link2 aria-hidden />],
  ]

  return (
    <div className="page-contained workbench pipeline-page">
      <header className="workbench-bar">
        <h1>{t('Pipeline')}</h1>
        <nav className="bar-tabs" aria-label={t('Pipeline views')}>
          {views.map(([key, label, icon]) => (
            <button key={key} type="button" className={view === key ? 'active' : ''} aria-pressed={view === key} onClick={() => setView(key)}>
              {icon} {label}
            </button>
          ))}
        </nav>
        <button type="button" className="button primary" onClick={() => setDialog({ kind: 'task', applicationId: view === 'board' ? selected?.application.id : undefined })}>
          <Plus aria-hidden /> {t('Add task')}
        </button>
      </header>

      {view === 'board' &&
        (journeys.length ? (
          <div className="pb">
            <PipelineJourneys
              journeys={journeys}
              view={journeyView}
              tasks={tasks.data}
              contacts={contacts.data}
              selectedId={selected?.application.id}
              onSelect={setSelectedId}
              summary={summary}
            />
            {selected ? (
              <ApplicationDetail
                key={selected.application.id}
                journey={selected}
                contacts={contacts.data}
                tasks={tasks.data}
                onAddTask={(applicationId) => setDialog({ kind: 'task', applicationId })}
                onAddContact={(applicationId) => setDialog({ kind: 'contact', applicationId })}
              />
            ) : (
              <aside className="ad">
                <p className="ad-empty">{t('No application matches these filters.')}</p>
              </aside>
            )}
          </div>
        ) : (
          <EmptyState
            title={t('Your pipeline has room for a first role')}
            description={t('Run a match for a saved opportunity, then choose Track application. CareerTwin will preserve the stage history.')}
          />
        ))}
      {view === 'calendar' && (
        <CareerCalendar
          events={events.data}
          tasks={tasks.data}
          applications={applications.data}
          opportunities={opportunityMap}
          onOpenApplication={openApplication}
          onAddTask={() => setDialog({ kind: 'task' })}
          importControl={<CalendarImport />}
        />
      )}
      {view === 'people' && (
        <PeopleWorkbench contacts={contacts.data} journeys={journeys} tasks={tasks.data} onAddContact={() => setDialog({ kind: 'contact' })} onOpenApplication={openApplication} />
      )}
      {view === 'connections' && (
        <div className="workbench-scroll pipeline-connections">
          <ConnectionsPanel />
        </div>
      )}

      {dialog?.kind === 'task' ? <TaskDialog journeys={journeys} contacts={contacts.data} applicationId={dialog.applicationId} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'contact' ? <ContactDialog journeys={journeys} applicationId={dialog.applicationId} onClose={() => setDialog(null)} /> : null}
    </div>
  )
}
