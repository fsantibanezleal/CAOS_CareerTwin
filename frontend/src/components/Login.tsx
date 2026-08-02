import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Fingerprint, Orbit, ShieldCheck, Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api, json } from '../api'
import type { User } from '../types'
import { ErrorState } from './Primitives'

export function Login({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => api<{ user: User }>('/api/auth/login', json('POST', { email, password })),
    onSuccess: (data) => onSuccess(data.user),
  })
  const submit = (event: FormEvent) => { event.preventDefault(); mutation.mutate() }
  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="login-title">
        <div className="brand-lockup"><span className="brand-mark"><Orbit /></span><span>CareerTwin</span></div>
        <div className="login-copy">
          <span className="eyebrow"><Sparkles size={14} /> Your professional evidence, connected</span>
          <h1 id="login-title">See your career as a living system.</h1>
          <p>Map what you know, trace every claim to evidence, compare opportunities honestly, and move each application forward with one private workbench.</p>
          <div className="trust-row">
            <span><Fingerprint /> One person per workspace</span>
            <span><ShieldCheck /> Agents propose. You approve.</span>
          </div>
        </div>
        <div className="constellation-preview" aria-hidden="true">
          <i className="node n1">Evidence</i><i className="node n2">Skills</i><i className="node n3">Experience</i><i className="node n4">Targets</i><i className="node n5">Growth</i>
          <svg viewBox="0 0 600 300"><path d="M95 90 C190 20 250 130 318 82 S468 60 510 138" /><path d="M124 225 C210 160 260 230 352 178 S470 175 520 216" /><path d="M318 82 L352 178 M124 225 L95 90 M510 138 L520 216" /></svg>
        </div>
      </section>
      <section className="login-panel" aria-label="Sign in">
        <div className="login-card">
          <span className="status-pill"><span /> Private self-hosted workspace</span>
          <h2>Welcome back</h2>
          <p>Sign in with an account created by your CareerTwin administrator.</p>
          <form onSubmit={submit}>
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {mutation.error && <ErrorState error={mutation.error} />}
            <button className="button primary wide" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : <>Enter your workspace <ArrowRight size={17} /></>}</button>
          </form>
          <small>There is no public registration. Your documents and tokens are never stored in this public repository.</small>
        </div>
      </section>
    </main>
  )
}
