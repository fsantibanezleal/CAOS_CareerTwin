import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Search, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { compact } from '../money'
import { capitalize, type Journey } from '../pipeline'
import type { CareerTask, Contact } from '../types'
import { ErrorState } from './Primitives'

/**
 * The people in the search, as a list and a detail.
 *
 * Contacts sat under a creation form in the agenda, each a line of name and organisation, with
 * a delete button that acted on the first click. The detail here carries the role, the email,
 * the notes, the application the person belongs to and the tasks with them.
 */

export function PeopleWorkbench({
  contacts,
  journeys,
  tasks,
  onAddContact,
  onOpenApplication,
}: {
  contacts: Contact[]
  journeys: Journey[]
  tasks: CareerTask[]
  onAddContact: () => void
  onOpenApplication: (applicationId: string) => void
}) {
  const { formatDate, t } = useI18n()
  const client = useQueryClient()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/pipeline/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirming(false)
      setSelectedId(undefined)
      client.invalidateQueries({ queryKey: ['contacts'] })
      client.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const journeyOf = new Map(journeys.map((journey) => [journey.application.id, journey]))
  const needle = query.trim().toLowerCase()
  const filtered = contacts.filter((contact) => !needle || `${contact.name} ${contact.organization} ${contact.role} ${contact.email}`.toLowerCase().includes(needle))
  // Grouped by the application each person belongs to; people without one are the network.
  const groups = new Map<string, Contact[]>()
  for (const contact of filtered) {
    const key = contact.application_id && journeyOf.has(contact.application_id) ? contact.application_id : ''
    groups.set(key, [...(groups.get(key) ?? []), contact])
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1))
  const selected = contacts.find((contact) => contact.id === selectedId) ?? filtered[0]
  const journey = selected?.application_id ? journeyOf.get(selected.application_id) : undefined
  const theirTasks = selected ? tasks.filter((task) => task.contact_id === selected.id) : []

  return (
    <div className="pw">
      <nav className="pw-list" aria-label={t('People')}>
        <header>
          <label className="search-field">
            <Search />
            <input aria-label={t('Search people')} placeholder={t('Search people')} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button type="button" className="ob-action" onClick={onAddContact}>
            <UserPlus aria-hidden /> {t('Add contact')}
          </button>
        </header>
        <div className="pw-groups">
          {ordered.map(([key, people]) => {
            const owner = key ? journeyOf.get(key) : undefined
            return (
              <section key={key || 'network'}>
                <h3 title={owner?.opportunity?.title}>{owner ? `${owner.opportunity?.title ?? t('Opportunity removed')} · ${owner.opportunity?.employer ?? ''}` : t('General network')}</h3>
                <ul>
                  {people.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        className={`pw-item${selected?.id === contact.id ? ' selected' : ''}`}
                        aria-current={selected?.id === contact.id}
                        onClick={() => {
                          setSelectedId(contact.id)
                          setConfirming(false)
                        }}
                      >
                        <b>{contact.name}</b>
                        <small>{[contact.role, contact.organization].filter(Boolean).join(' · ') || t('No role recorded')}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {!filtered.length ? <p className="ad-empty">{contacts.length ? t('No one matches this search.') : t('No contacts yet. Add a recruiter, hiring manager or referral.')}</p> : null}
        </div>
      </nav>

      {selected ? (
        <article className="pw-detail" aria-label={selected.name}>
          <header>
            <h2>{selected.name}</h2>
            <p>{[selected.role, selected.organization].filter(Boolean).join(' · ') || t('No role recorded')}</p>
          </header>
          <dl className="pw-facts">
            <div>
              <dt>{t('Email')}</dt>
              <dd>
                {selected.email ? (
                  <a href={`mailto:${selected.email}`}>
                    <Mail aria-hidden /> {selected.email}
                  </a>
                ) : (
                  t('Not recorded')
                )}
              </dd>
            </div>
            <div>
              <dt>{t('Added')}</dt>
              <dd>{formatDate(selected.created_at, { dateStyle: 'medium' })}</dd>
            </div>
          </dl>
          {journey ? (
            <section className="pw-section">
              <h3>{t('Application')}</h3>
              <button type="button" className="pw-application" onClick={() => onOpenApplication(journey.application.id)}>
                <span className={`ad-stage stage-${journey.application.stage}`}>{capitalize(t(journey.application.stage))}</span>
                <b>{journey.opportunity?.title ?? t('Opportunity removed')}</b>
                <small>
                  {[
                    journey.opportunity?.employer,
                    journey.fit !== null ? `${journey.fit}% ${t('fit')}` : null,
                    journey.askLow !== null && journey.askHigh !== null ? `${t('Ask')} ${compact(journey.askLow)}\u2013${compact(journey.askHigh)}` : null,
                    t('since {date}', { date: formatDate(journey.enteredAt, { day: 'numeric', month: 'short' }) }),
                  ]
                    .filter(Boolean)
                    .join(' \u00b7 ')}
                </small>
              </button>
            </section>
          ) : null}
          {selected.notes ? (
            <section className="pw-section">
              <h3>{t('Notes')}</h3>
              <p className="ad-notes">{selected.notes}</p>
            </section>
          ) : null}
          <section className="pw-section">
            <h3>{t('Tasks with {name}', { name: selected.name })}</h3>
            {theirTasks.length ? (
              <ul className="ad-list">
                {theirTasks.map((task) => {
                  const at = task.starts_at ?? task.due_at
                  return (
                    <li key={task.id}>
                      <span>
                        <b>{task.title}</b>
                        <small>
                          {capitalize(t(task.kind))} {'·'} {at ? formatDate(at, { dateStyle: 'medium', timeStyle: 'short' }) : t('Not scheduled')}
                          {task.completed_at ? ` · ${t('Done')}` : ''}
                        </small>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="ad-empty">{t('No tasks with this person.')}</p>
            )}
          </section>
          <footer className="pw-actions">
            {confirming ? (
              <>
                <span>{t('Delete {name}? Their tasks stay, without the link.', { name: selected.name })}</span>
                <button type="button" className="button danger" disabled={remove.isPending} onClick={() => remove.mutate(selected.id)}>
                  <Trash2 aria-hidden /> {t('Delete')}
                </button>
                <button type="button" className="button ghost" onClick={() => setConfirming(false)}>
                  {t('Cancel')}
                </button>
              </>
            ) : (
              <button type="button" className="button ghost danger" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden /> {t('Delete contact')}
              </button>
            )}
          </footer>
          {remove.error ? <ErrorState error={remove.error} /> : null}
        </article>
      ) : null}
    </div>
  )
}
