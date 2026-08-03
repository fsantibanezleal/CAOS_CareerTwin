import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, FileCheck2, Radar, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../api'
import { EmptyState, ErrorState, Loading, PageHeader, Panel, Score, StatCard } from '../components/Primitives'
import { useI18n } from '../i18n'
import type { Dashboard } from '../types'

export function TodayPage() {
  const { formatDate, plural, t } = useI18n()
  const dateLabel = (value?: string) => value ? formatDate(value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('No date')
  const query = useQuery({ queryKey: ['today'], queryFn: () => api<Dashboard>('/api/workspace/today') })
  if (query.isPending) return <Loading label="Building your career control room" />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  const data = query.data
  const applicationTotal = Object.values(data.applications_by_stage).reduce((sum, value) => sum + value, 0)
  return (
    <>
      <PageHeader eyebrow={t('Your career control room')} title={t('Today, with evidence in view.')} description={t('One place for profile coverage, opportunity signals, application momentum, and the next concrete action.')} actions={<a className="button secondary" href="/api/workspace/export"><FileCheck2 size={16} /> {t('Export my data')}</a>} />
      <section className="stats-grid">
        <StatCard label={t('Profile completeness')} value={`${Math.round(data.profile_completeness * 100)}%`} detail={plural(data.confirmed_evidence, '{count} confirmed evidence claim', '{count} confirmed evidence claims')} tone="cyan" />
        <StatCard label={t('Portfolio alignment')} value={<Score value={data.global_alignment} />} detail={t('{count}% evidence coverage', { count: Math.round(data.global_alignment_coverage * 100) })} tone="violet" />
        <StatCard label={t('Opportunities in view')} value={data.active_opportunities} detail={plural(applicationTotal, '{count} tracked application', '{count} tracked applications')} tone="amber" />
        <StatCard label={t('Evidence review')} value={data.review_pending} detail={t('proposals waiting for your decision')} tone="green" />
      </section>
      <div className="dashboard-grid">
        <Panel title={t('Next best moves')} subtitle={t('Prioritized by urgency and what you control')} actions={<Link to="/pipeline" className="text-button">{t('Open pipeline')} <ArrowRight /></Link>}>
          {data.upcoming_tasks.length ? <div className="task-list">{data.upcoming_tasks.map((task) => <article key={task.id}><span className={`task-kind kind-${task.kind}`}>{task.kind === 'meeting' ? <CalendarClock /> : <CircleDashed />}</span><div><b>{task.title}</b><small>{t(task.kind)} · {dateLabel(task.due_at ?? task.starts_at)}</small></div><span className="status-badge">{t('Upcoming')}</span></article>)}</div> : <EmptyState title={t('The runway is clear')} description={t('Add a deadline, meeting, or task from the pipeline to keep momentum visible.')} action={<Link className="button secondary" to="/pipeline">{t('Plan an action')}</Link>} />}
        </Panel>
        <Panel title={t('Readiness pulse')} subtitle={t('Truthful signals across the evidence system')}>
          <div className="pulse-list">
            <Link to="/profile"><span><FileCheck2 /></span><div><b>{t('Evidence inbox')}</b><small>{data.review_pending ? plural(data.review_pending, '{count} item needs review', '{count} items need review') : t('All proposals have a decision')}</small></div><ArrowRight /></Link>
            <Link to="/matches"><span><Radar /></span><div><b>{t('Opportunity fit')}</b><small>{t(data.global_alignment === undefined ? 'Add evidence before drawing conclusions' : 'Inspect gaps and uncertainty')}</small></div><ArrowRight /></Link>
            <Link to="/opportunities"><span><Sparkles /></span><div><b>{t('Search landscape')}</b><small>{plural(data.active_opportunities, '{count} active signal in your own dataset', '{count} active signals in your own dataset')}</small></div><ArrowRight /></Link>
          </div>
        </Panel>
        <Panel title={t('Application flow')} subtitle={t('Current state, never a judgment of your value')} className="span-two">
          {applicationTotal ? <div className="stage-ribbon">{Object.entries(data.applications_by_stage).map(([stage, count]) => <div key={stage}><span><CheckCircle2 /></span><b>{count}</b><small>{t(stage)}</small></div>)}</div> : <EmptyState title={t('No applications tracked yet')} description={t('Save an opportunity, review its alignment, then add it to your candidate-owned pipeline.')} action={<Link className="button primary" to="/opportunities">{t('Capture an opportunity')}</Link>} />}
        </Panel>
      </div>
      <p className="semantic-note"><Radar /> {t('Scores show alignment to saved requirements and confirmed evidence. They are not hiring probabilities.')}</p>
    </>
  )
}
