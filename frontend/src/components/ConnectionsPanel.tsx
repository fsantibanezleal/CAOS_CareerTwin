import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarSync, Check, Chrome, Copy, Link2, Mail, RefreshCw, ShieldOff, Unplug } from 'lucide-react'
import { useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import type { ConnectorStatus, EmailThread, ExternalConnection } from '../types'
import { EmptyState, ErrorState, Loading, Panel } from './Primitives'

function ProviderConnection({ connection }: { connection: ExternalConnection }) {
  const { formatDate, t } = useI18n()
  const client = useQueryClient()
  const services = new Set(connection.connection_metadata.services ?? [])
  const calendar = useMutation({
    mutationFn: () => api(`/api/connectors/connections/${connection.id}/calendar/sync`, json('POST', {})),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['connector-status'] }); client.invalidateQueries({ queryKey: ['tasks'] }) },
  })
  const email = useMutation({
    mutationFn: () => api(`/api/connectors/connections/${connection.id}/email/sync`, json('POST', { days_back: 180, max_threads: 100, create_follow_up_tasks: true })),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['connector-status'] }); client.invalidateQueries({ queryKey: ['email-threads'] }); client.invalidateQueries({ queryKey: ['tasks'] }) },
  })
  const disconnect = useMutation({ mutationFn: () => api(`/api/connectors/connections/${connection.id}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['connector-status'] }) })
  const error = calendar.error || email.error || disconnect.error
  return <article className="connection-card">
    <div className={`connection-mark ${connection.provider}`}>{connection.provider === 'google' ? 'G' : 'M'}</div>
    <div><b>{connection.connection_metadata.display_name || connection.provider}</b><small>{connection.connection_metadata.account_hint || t('Delegated account')} · {t(connection.status)}</small><span>{services.has('calendar') && t('Calendar')}{services.size > 1 && ' + '}{services.has('email') && t('Recruiting email')}{connection.last_synced_at && t(' · synced {date}', { date: formatDate(connection.last_synced_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</span></div>
    <div className="connection-actions">
      {services.has('calendar') && <button className="button secondary" disabled={calendar.isPending} onClick={() => calendar.mutate()}><CalendarSync /> {t('Sync calendar')}</button>}
      {services.has('email') && <button className="button secondary" disabled={email.isPending} onClick={() => email.mutate()}><Mail /> {t('Sync email')}</button>}
      <button className="button ghost danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}><Unplug /> {t('Disconnect')}</button>
    </div>
    {error && <ErrorState error={error} />}
  </article>
}

export function ConnectionsPanel() {
  const { formatDate, plural, t } = useI18n()
  const client = useQueryClient()
  const [issuedToken, setIssuedToken] = useState('')
  const status = useQuery({ queryKey: ['connector-status'], queryFn: () => api<ConnectorStatus>('/api/connectors/status') })
  const threads = useQuery({ queryKey: ['email-threads'], queryFn: () => api<EmailThread[]>('/api/connectors/email/threads') })
  const authorize = useMutation({
    mutationFn: (provider: string) => api<{ authorize_url: string }>(`/api/connectors/oauth/${provider}/authorize`, json('POST', { services: ['calendar', 'email'], redirect_after: '/pipeline' })),
    onSuccess: (result) => window.location.assign(result.authorize_url),
  })
  const issue = useMutation({
    mutationFn: () => api<{ token: string }>('/api/connectors/browser/credentials', json('POST', { label: 'Personal browser extension', expires_in_days: 180 })),
    onSuccess: (result) => { setIssuedToken(result.token); client.invalidateQueries({ queryKey: ['connector-status'] }) },
  })
  const revoke = useMutation({ mutationFn: (id: string) => api(`/api/connectors/browser/credentials/${id}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['connector-status'] }) })
  if (status.isPending || threads.isPending) return <Loading label={t('Checking private connections')} />
  if (status.error || threads.error) return <ErrorState error={status.error || threads.error} />
  return <div className="connections-layout">
    <Panel title={t('Calendar and recruiting email')} subtitle={t('Explicit OAuth consent, encrypted refresh tokens, and no automated outreach')}>
      <div className="provider-connect-grid">{(['google', 'microsoft'] as const).map((provider) => <article key={provider}><span>{provider === 'google' ? 'G' : 'M'}</span><div><b>{provider === 'google' ? 'Google Workspace' : 'Microsoft 365'}</b><small>{t(status.data.oauth_providers[provider] ? 'Available for delegated consent' : 'Operator configuration required')}</small></div><button className="button primary" disabled={!status.data.oauth_providers[provider] || authorize.isPending} onClick={() => authorize.mutate(provider)}><Link2 /> {t('Connect')}</button></article>)}</div>
      {authorize.error && <ErrorState error={authorize.error} />}
      {status.data.connections.length ? <div className="connection-list">{status.data.connections.map((item) => <ProviderConnection key={item.id} connection={item} />)}</div> : <EmptyState title={t('No delegated accounts')} description={t('Connect Google or Microsoft only when you want CareerTwin to synchronize your own calendar or recruiting threads.')} />}
    </Panel>
    <Panel title={t('Browser opportunity capture')} subtitle={t('A page is sent only when you press Capture in the extension')}>
      <div className="extension-callout"><Chrome /><div><b>{t('Manifest V3 · explicit capture')}</b><p>{t('Issue a credential, download the extension, load it unpacked, and paste the credential once. Revoke it here at any time.')}</p></div><a className="button secondary" href="/api/connectors/browser/extension.zip"><Chrome /> {t('Download extension')}</a></div>
      <div className="form-actions"><button className="button primary" disabled={issue.isPending} onClick={() => issue.mutate()}><Check /> {t('Issue new credential')}</button></div>
      {issuedToken && <div className="one-time-secret"><ShieldOff /><div><b>{t('Copy now — shown only once')}</b><code>{issuedToken}</code></div><button className="button secondary" onClick={() => navigator.clipboard.writeText(issuedToken)}><Copy /> {t('Copy')}</button></div>}
      {(issue.error || revoke.error) && <ErrorState error={issue.error || revoke.error} />}
      <div className="credential-list">{status.data.browser_credentials.map((credential) => <article key={credential.id}><div><b>{credential.label}</b><small>{credential.revoked_at ? t('Revoked') : t('Expires {date}', { date: credential.expires_at ? formatDate(credential.expires_at) : t('never') })}{credential.last_used_at && t(' · used {date}', { date: formatDate(credential.last_used_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</small></div>{!credential.revoked_at && <button className="button ghost danger" onClick={() => revoke.mutate(credential.id)}>{t('Revoke')}</button>}</article>)}</div>
    </Panel>
    <Panel title={t('Recruiting thread index')} subtitle={t('Read-only excerpts retained for a bounded period and linked to your applications when identifiable')} actions={<span className="status-badge"><RefreshCw /> {plural(threads.data.length, '{count} thread', '{count} threads')}</span>}>
      {threads.data.length ? <div className="thread-list">{threads.data.map((thread) => <details key={thread.id}><summary><span><Mail /></span><div><b>{thread.subject || t('Untitled thread')}</b><small>{thread.participants.map((item) => item.email).slice(0, 3).join(' · ')}{thread.last_message_at && ` · ${formatDate(thread.last_message_at)}`}</small></div></summary><div>{thread.messages.map((message) => <article key={message.id}><small>{message.from} · {message.sent_at ? formatDate(message.sent_at, { dateStyle: 'medium', timeStyle: 'short' }) : t('Date unavailable')}</small><p>{message.excerpt}</p></article>)}</div></details>)}</div> : <EmptyState title={t('No recruiting threads imported')} description={t('After connecting email, run a sync. CareerTwin uses bounded recruiting keywords and never sends replies.')} />}
    </Panel>
  </div>
}
