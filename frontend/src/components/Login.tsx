import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Fingerprint, Languages, Orbit, ShieldCheck, Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import type { User } from '../types'
import { ErrorState } from './Primitives'

export function Login({ onSuccess }: { onSuccess: (user: User) => void }) {
  const { locale, setLocale, t } = useI18n()
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
          <span className="eyebrow"><Sparkles size={14} /> {t('Your professional evidence, connected')}</span>
          <h1 id="login-title">{t('See your career as a living system.')}</h1>
          <p>{t('Map what you know, trace every claim to evidence, compare opportunities honestly, and move each application forward with one private workbench.')}</p>
          <div className="trust-row">
            <span><Fingerprint /> {t('One person per workspace')}</span>
            <span><ShieldCheck /> {t('Agents propose. You approve.')}</span>
          </div>
        </div>
        <div className="constellation-preview" aria-hidden="true">
          <i className="node n1">{t('Evidence')}</i><i className="node n2">{t('Skills')}</i><i className="node n3">{t('Experience')}</i><i className="node n4">{t('Targets')}</i><i className="node n5">{t('Growth')}</i>
          <svg viewBox="0 0 600 300"><path d="M95 90 C190 20 250 130 318 82 S468 60 510 138" /><path d="M124 225 C210 160 260 230 352 178 S470 175 520 216" /><path d="M318 82 L352 178 M124 225 L95 90 M510 138 L520 216" /></svg>
        </div>
      </section>
      <section className="login-panel" aria-label={t('Sign in')}>
        <div className="login-card">
          <button type="button" className="button ghost login-language" onClick={() => setLocale(locale === 'en' ? 'es' : 'en')} aria-label={t(locale === 'en' ? 'Switch to Spanish' : 'Switch to English')}><Languages size={16} /> {locale === 'en' ? 'ES' : 'EN'}</button>
          <span className="status-pill"><span /> {t('Private self-hosted workspace')}</span>
          <h2>{t('Welcome back')}</h2>
          <p>{t('Sign in with an account created by your CareerTwin administrator.')}</p>
          <form onSubmit={submit}>
            <label>{t('Email')}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>{t('Password')}<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {mutation.error && <ErrorState error={mutation.error} />}
            <button className="button primary wide" disabled={mutation.isPending}>{mutation.isPending ? t('Signing in…') : <>{t('Enter your workspace')} <ArrowRight size={17} /></>}</button>
          </form>
          <small>{t('There is no public registration. Your documents and tokens are never stored in this public repository.')}</small>
        </div>
      </section>
    </main>
  )
}
