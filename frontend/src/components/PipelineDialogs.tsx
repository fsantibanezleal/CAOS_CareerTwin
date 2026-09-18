import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import { capitalize, type Journey } from '../pipeline'
import type { Contact } from '../types'
import { Dialog } from './Dialog'
import { ErrorState } from './Primitives'

/**
 * Creating a task or a contact. Both were forms over the page: the task form absolutely
 * positioned over the board, the contact form stacked above the list. Both named applications
 * as "Application 1a2b3c4d", the first eight characters of an identifier.
 */

const roleLabel = (journey: Journey) => [journey.opportunity?.title, journey.opportunity?.employer].filter(Boolean).join(' · ') || journey.application.id

export function TaskDialog({
  journeys,
  contacts,
  applicationId: initialApplication = '',
  onClose,
}: {
  journeys: Journey[]
  contacts: Contact[]
  applicationId?: string
  onClose: () => void
}) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [kind, setKind] = useState('task')
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [applicationId, setApplicationId] = useState(initialApplication)
  const [contactId, setContactId] = useState('')
  const [notes, setNotes] = useState('')
  const create = useMutation({
    mutationFn: () => {
      const at = when ? new Date(when).toISOString() : null
      return api(
        '/api/pipeline/tasks',
        json('POST', {
          title,
          kind,
          application_id: applicationId || null,
          contact_id: contactId || null,
          // A meeting starts at its time; everything else is due by it.
          starts_at: kind === 'meeting' ? at : null,
          due_at: at,
          notes,
          contact: {},
        }),
      )
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['tasks'] })
      client.invalidateQueries({ queryKey: ['today'] })
      onClose()
    },
  })
  const compatible = contacts.filter((item) => !applicationId || !item.application_id || item.application_id === applicationId)
  return (
    <Dialog label={t('Add task or meeting')} onClose={onClose}>
      <form
        className="pd-form"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <h2>{t('Add task or meeting')}</h2>
        <div className="pd-row">
          <label>
            {t('Kind')}
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {['task', 'meeting', 'deadline', 'reminder'].map((value) => (
                <option key={value} value={value}>
                  {capitalize(t(value))}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('When')}
            <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          </label>
        </div>
        <label>
          {t('What needs to happen?')}
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={300} />
        </label>
        <div className="pd-row">
          <label>
            {t('Application')}
            <select
              value={applicationId}
              onChange={(event) => {
                setApplicationId(event.target.value)
                setContactId('')
              }}
            >
              <option value="">{t('General career task')}</option>
              {journeys.map((journey) => (
                <option key={journey.application.id} value={journey.application.id}>
                  {roleLabel(journey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('With')}
            <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
              <option value="">{t('No associated contact')}</option>
              {compatible.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.name, item.organization].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t('Notes')}
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {create.error ? <ErrorState error={create.error} /> : null}
        <footer>
          <button type="button" className="button ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="button primary" disabled={create.isPending || !title.trim()}>
            <Check aria-hidden /> {t('Add')}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}

export function ContactDialog({ journeys, applicationId: initialApplication = '', onClose }: { journeys: Journey[]; applicationId?: string; onClose: () => void }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const initialEmployer = journeys.find((journey) => journey.application.id === initialApplication)?.opportunity?.employer ?? ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState(initialEmployer)
  const [role, setRole] = useState('')
  const [applicationId, setApplicationId] = useState(initialApplication)
  const [notes, setNotes] = useState('')
  const create = useMutation({
    mutationFn: () => api('/api/pipeline/contacts', json('POST', { name, email: email || null, organization, role, application_id: applicationId || null, notes })),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['contacts'] })
      onClose()
    },
  })
  return (
    <Dialog label={t('Add contact')} onClose={onClose}>
      <form
        className="pd-form"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <h2>{t('Add contact')}</h2>
        <div className="pd-row">
          <label>
            {t('Name')}
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} />
          </label>
          <label>
            {t('Email (optional)')}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        </div>
        <div className="pd-row">
          <label>
            {t('Organization')}
            <input value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={240} />
          </label>
          <label>
            {t('Role')}
            <input value={role} onChange={(event) => setRole(event.target.value)} maxLength={160} />
          </label>
        </div>
        <label>
          {t('Application')}
          <select value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
            <option value="">{t('General network contact')}</option>
            {journeys.map((journey) => (
              <option key={journey.application.id} value={journey.application.id}>
                {roleLabel(journey)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Notes')}
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {create.error ? <ErrorState error={create.error} /> : null}
        <footer>
          <button type="button" className="button ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="button primary" disabled={create.isPending || !name.trim()}>
            <Check aria-hidden /> {t('Add')}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
