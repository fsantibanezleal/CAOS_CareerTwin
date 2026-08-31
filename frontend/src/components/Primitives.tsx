import { AlertTriangle, ArrowUpRight, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
export function StatCard({ label, value, detail, tone = 'cyan' }: { label: string; value: ReactNode; detail: string; tone?: 'cyan' | 'violet' | 'amber' | 'green' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-spark" aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function Panel({ title, subtitle, actions, children, className = '' }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const { t } = useI18n()
  return <div className="state-message" role="status"><LoaderCircle className="spin" />{t(label)}</div>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n()
  const message = error instanceof Error ? error.message : 'The request could not be completed.'
  return (
    <div className="state-message error" role="alert">
      <AlertTriangle />
      <div><strong>{t('Something needs attention')}</strong><p>{t(message)}</p></div>
      {retry && <button className="button secondary" onClick={retry}>{t('Try again')}</button>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-orbit" aria-hidden="true" />
      <h3>{title}</h3><p>{description}</p>{action}
    </div>
  )
}

export function Score({ value, label = 'alignment' }: { value?: number; label?: string }) {
  const { t } = useI18n()
  if (value === undefined || value === null) return <span className="score unknown">{t('Insufficient evidence')}</span>
  const percent = Math.round(value * 100)
  return <span className="score" aria-label={`${percent}% ${t(label)}`}><b>{percent}</b><small>%</small></span>
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="external-link">{children}<ArrowUpRight size={14} /></a>
}
