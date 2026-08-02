import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, RotateCcw, Shield, ShieldOff, Trash2, UserCog } from 'lucide-react'
import { useState } from 'react'
import { api, json } from '../api'
import { EmptyState, ErrorState, Loading, PageHeader, Panel } from '../components/Primitives'
import type { AdminUser } from '../types'

function CreateAccount() {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [superuser, setSuperuser] = useState(false)
  const create = useMutation({ mutationFn: () => api('/api/admin/users', json('POST', { email, display_name: name, temporary_password: password, is_superuser: superuser, locale: 'en' })), onSuccess: () => { setOpen(false); setEmail(''); setName(''); setPassword(''); setSuperuser(false); client.invalidateQueries({ queryKey: ['admin-users'] }) } })
  return open ? <form className="admin-create" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><div className="form-grid two"><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label></div><label>Temporary password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" /><small>Share out of band. The account must change it before adding sensitive documents.</small></label><label className="checkbox"><input type="checkbox" checked={superuser} onChange={(event) => setSuperuser(event.target.checked)} /> Grant account-administration permissions</label>{create.error && <ErrorState error={create.error} />}<div className="form-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button primary"><Plus /> Create invited seeker</button></div></form> : <button className="button primary" onClick={() => setOpen(true)}><Plus /> Create account</button>
}

function UserRow({ user, currentUserId }: { user: AdminUser; currentUserId: string }) {
  const client = useQueryClient()
  const action = useMutation({ mutationFn: ({ kind }: { kind: 'disable' | 'restore' | 'revoke' }) => api(`/api/admin/users/${user.id}/${kind === 'revoke' ? 'revoke-sessions' : kind}`, { method: 'POST' }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const purge = useMutation({ mutationFn: () => api(`/api/admin/users/${user.id}?confirm=${encodeURIComponent(user.email)}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  return <article className={`user-row ${user.is_active ? '' : 'disabled'}`}><span className="avatar large">{user.display_name.slice(0, 2).toUpperCase()}</span><div><h3>{user.display_name}</h3><p>{user.email}</p><small>{user.is_superuser ? 'Superuser + independent seeker workspace' : 'Seeker workspace'} · {user.locale.toUpperCase()}</small></div><span className={`status-badge ${user.is_active ? 'confirmed' : 'rejected'}`}>{user.is_active ? 'Active' : 'Disabled'}</span><div className="user-actions">{user.id === currentUserId ? <span>Current account</span> : <>{user.is_active ? <button className="button ghost" onClick={() => action.mutate({ kind: 'disable' })}><ShieldOff /> Disable</button> : <button className="button ghost" onClick={() => action.mutate({ kind: 'restore' })}><RotateCcw /> Restore</button>}<button className="button ghost" onClick={() => action.mutate({ kind: 'revoke' })}><KeyRound /> Revoke sessions</button><button className="button ghost danger" onClick={() => window.confirm(`Permanently purge ${user.email} and all of that account's data? This cannot be undone.`) && purge.mutate()}><Trash2 /> Purge</button></>}</div>{(action.error || purge.error) && <ErrorState error={action.error || purge.error} />}</article>
}

export function AdminPage({ currentUserId }: { currentUserId: string }) {
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api<AdminUser[]>('/api/admin/users') })
  if (users.isPending) return <Loading label="Loading account administration" />
  if (users.error) return <ErrorState error={users.error} />
  return <><PageHeader eyebrow="Superuser control plane" title="Manage accounts, never inspect their careers." description="Create, disable, restore, revoke, or explicitly purge accounts. Each seeker retains an isolated profile and opportunity workspace." actions={<CreateAccount />} /><div className="admin-principle"><Shield /><div><b>Administrative boundary</b><p>This surface exposes account metadata only. It has no endpoint or browser for another person’s documents, profile, opportunities, matches, conversations, or agent outputs.</p></div></div><Panel title="Invited accounts" subtitle={`${users.data.length} independently scoped seeker workspace${users.data.length === 1 ? '' : 's'}`}>{users.data.length ? <div className="user-list">{users.data.map((user) => <UserRow key={user.id} user={user} currentUserId={currentUserId} />)}</div> : <EmptyState title="No accounts" description="Create the first invited seeker account." />}</Panel><section className="admin-audit-note"><UserCog /><div><h2>Every action is audited</h2><p>Account lifecycle actions create redacted audit records. Session revocation is immediate. Purge requires an exact email confirmation and is intentionally irreversible.</p></div></section></>
}
