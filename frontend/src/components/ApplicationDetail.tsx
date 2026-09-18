import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, CalendarPlus, Check, Mail, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import { ACTIVE_STAGES, capitalize, isClosed, openTasksFor, TRANSITIONS, type Journey } from '../pipeline'
import type { CareerTask, Contact } from '../types'
import { ErrorState } from './Primitives'
import { SalaryBand, type Compensation } from './SalaryBand'

/**
 * Everything about one application, beside the journeys.
 *
 * The board card showed a channel, a title and a date. The stage history, the contacts, the
 * tasks, the fit and the salary band all existed and none was reachable from the card. Moving
 * an application was a select that fired on change; a slip into "rejected" closed it for good,
 * since closed stages have no transitions. Moves now name what they do and ask to confirm.
 */

const CLOSING = new Set(['rejected', 'withdrawn', 'accepted'])
const ALL_OPEN: readonly string[] = ACTIVE_STAGES

export function ApplicationDetail({
  journey,
  contacts,
  tasks,
  onAddTask,
  onAddContact,
}: {
  journey: Journey
  contacts: Contact[]
  tasks: CareerTask[]
  onAddTask: (applicationId: string) => void
  onAddContact: (applicationId: string) => void
}) {
  const { formatDate, plural, t } = useI18n()
  const client = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const { application, opportunity, run } = journey
  const refresh = () => {
    for (const key of ['applications', 'pipeline-events', 'analytics', 'today', 'tasks']) client.invalidateQueries({ queryKey: [key] })
  }
  const move = useMutation({
    mutationFn: (stage: string) => api(`/api/pipeline/applications/${application.id}/stage`, json('POST', { stage, note })),
    onSuccess: () => {
      setPending(null)
      setNote('')
      refresh()
    },
  })
  const complete = useMutation({
    mutationFn: (id: string) => api(`/api/pipeline/tasks/${id}/complete`, { method: 'POST' }),
    onSuccess: refresh,
  })

  const closed = isClosed(application.stage)
  const order = (stage: string) => (CLOSING.has(stage) ? 2 : ALL_OPEN.indexOf(stage) < ALL_OPEN.indexOf(application.stage) ? 1 : 0)
  const next = [...(TRANSITIONS[application.stage] ?? [])].sort((a, b) => order(a) - order(b))
  const assessments = run?.assessments ?? []
  const met = assessments.filter((item) => item.status === 'met').length
  const gaps = assessments.filter((item) => item.status === 'missing' || item.status === 'conflict').length
  const people = contacts.filter((contact) => contact.application_id === application.id)
  const open = openTasksFor(tasks, application.id)
  const workMode = opportunity?.remote_mode && opportunity.remote_mode !== 'unspecified' ? t(opportunity.remote_mode) : ''
  const place = [opportunity?.employer || t('Employer not specified'), opportunity?.location, workMode].filter(Boolean).join(' · ')
  const waited = journey.daysInStage === 0 ? t('today') : plural(journey.daysInStage, '{count} day', '{count} days')
  const moveLabel = (stage: string) => {
    if (stage === 'rejected') return t('Mark rejected')
    if (stage === 'withdrawn') return t('Withdraw')
    if (stage === 'accepted') return t('Accept offer')
    if (stage === application.stage) return t('Log another {stage}', { stage: t(stage) })
    if (ALL_OPEN.indexOf(stage) < ALL_OPEN.indexOf(application.stage)) return t('Back to {stage}', { stage: t(stage) })
    return t('Move to {stage}', { stage: t(stage) })
  }

  return (
    <aside className="ad" aria-label={t('Application detail')} data-application={application.id}>
      <header className="ad-head">
        <div className="ad-tags">
          <span className={`ad-stage stage-${application.stage}`}>{capitalize(t(application.stage))}</span>
          <span className="ad-channel">{t(application.channel)}</span>
          {opportunity ? (
            <Link className="ob-action" to={`/opportunities?role=${opportunity.id}`}>
              <ArrowUpRight aria-hidden /> {t('Open role')}
            </Link>
          ) : null}
        </div>
        <h2>{opportunity?.title ?? t('Opportunity removed')}</h2>
        <p>{place}</p>
      </header>

      <dl className="ad-figures">
        <div className="fit">
          <dt>{t('Fit')}</dt>
          <dd>{journey.fit === null ? '–' : `${journey.fit}%`}</dd>
        </div>
        <div>
          <dt>{t('Met')}</dt>
          <dd>
            {met}
            <span>/{assessments.length}</span>
          </dd>
        </div>
        <div>
          <dt>{t('Gaps')}</dt>
          <dd className={gaps ? 'warn' : 'clear'}>{gaps}</dd>
        </div>
        <div>
          <dt>{closed ? t('Closed') : t('In stage')}</dt>
          <dd>{closed ? formatDate(journey.enteredAt, { day: 'numeric', month: 'short' }) : waited}</dd>
        </div>
      </dl>

      {opportunity?.compensation && (opportunity.compensation as Compensation).floor !== undefined ? (
        <SalaryBand compensation={opportunity.compensation as Compensation} variant="compact" />
      ) : (
        <p className="ad-empty">{t('No salary band researched for this role.')}</p>
      )}

      <div className="ad-body">
        <section className="ad-section ad-moves">
          <h3>{t('Next move')}</h3>
          {closed ? (
            <p className="ad-empty">{t('Closed applications have no further moves.')}</p>
          ) : pending ? (
            <div className={`ad-confirm${CLOSING.has(pending) && pending !== 'accepted' ? ' danger' : ''}`}>
              <p>
                {CLOSING.has(pending)
                  ? t('{action} closes this application. Closed applications cannot be reopened.', { action: moveLabel(pending) })
                  : t('{action}?', { action: moveLabel(pending) })}
              </p>
              <input aria-label={t('Note for the history (optional)')} placeholder={t('Note for the history (optional)')} value={note} onChange={(event) => setNote(event.target.value)} />
              <div>
                <button type="button" className={`button ${CLOSING.has(pending) && pending !== 'accepted' ? 'danger' : 'primary'}`} disabled={move.isPending} onClick={() => move.mutate(pending)}>
                  <Check aria-hidden /> {t('Confirm')}
                </button>
                <button type="button" className="button ghost" onClick={() => setPending(null)}>
                  {t('Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="ad-move-list">
              {next.map((stage) => (
                <button key={stage} type="button" className={`ad-move stage-${stage}${CLOSING.has(stage) ? ' closing' : ''}`} onClick={() => setPending(stage)}>
                  {moveLabel(stage)}
                </button>
              ))}
            </div>
          )}
          {move.error ? <ErrorState error={move.error} /> : null}
        </section>

        <section className="ad-section">
          <h3>{t('History')}</h3>
          <ol className="ad-history">
            {[...journey.events].reverse().map((event) => (
              <li key={event.id} className={`stage-${event.to_stage}`}>
                <i aria-hidden />
                <span>
                  <b>{t(event.to_stage)}</b>
                  <time dateTime={event.occurred_at}>{formatDate(event.occurred_at, { dateStyle: 'medium' })}</time>
                </span>
                {event.note ? <p>{event.note}</p> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="ad-section">
          <header>
            <h3>{t('Next steps')}</h3>
            <button type="button" className="ob-action" onClick={() => onAddTask(application.id)}>
              <CalendarPlus aria-hidden /> {t('Add')}
            </button>
          </header>
          {open.length ? (
            <ul className="ad-list">
              {open.map((task) => {
                const at = task.starts_at ?? task.due_at
                return (
                  <li key={task.id}>
                    <span>
                      <b>{task.title}</b>
                      <small>
                        {capitalize(t(task.kind))} {'·'} {at ? formatDate(at, { dateStyle: 'medium', timeStyle: 'short' }) : t('Not scheduled')}
                      </small>
                    </span>
                    <button type="button" className="icon-button" aria-label={t('Complete {task}', { task: task.title })} disabled={complete.isPending} onClick={() => complete.mutate(task.id)}>
                      <Check />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="ad-empty">{closed ? t('No open tasks.') : t('No next step recorded. Add one so it is not forgotten.')}</p>
          )}
        </section>

        <section className="ad-section">
          <header>
            <h3>{t('People')}</h3>
            <button type="button" className="ob-action" onClick={() => onAddContact(application.id)}>
              <UserPlus aria-hidden /> {t('Add')}
            </button>
          </header>
          {people.length ? (
            <ul className="ad-list">
              {people.map((contact) => (
                <li key={contact.id}>
                  <span>
                    <b>{contact.name}</b>
                    <small>{[contact.role, contact.organization].filter(Boolean).join(' · ') || t('No role recorded')}</small>
                  </span>
                  {contact.email ? (
                    <a className="icon-button" href={`mailto:${contact.email}`} aria-label={t('Email {name}', { name: contact.name })}>
                      <Mail />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-empty">{t('No contacts for this application.')}</p>
          )}
        </section>


        {application.notes ? (
          <section className="ad-section">
            <h3>{t('Notes')}</h3>
            <p className="ad-notes">{application.notes}</p>
          </section>
        ) : null}
        {complete.error ? <ErrorState error={complete.error} /> : null}
      </div>
    </aside>
  )
}
