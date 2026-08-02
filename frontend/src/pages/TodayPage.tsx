import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, FileCheck2, Radar, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../api'
import { EmptyState, ErrorState, Loading, PageHeader, Panel, Score, StatCard } from '../components/Primitives'
import type { Dashboard } from '../types'

function dateLabel(value?: string) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function TodayPage() {
  const query = useQuery({ queryKey: ['today'], queryFn: () => api<Dashboard>('/api/workspace/today') })
  if (query.isPending) return <Loading label="Building your career control room" />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  const data = query.data
  const applicationTotal = Object.values(data.applications_by_stage).reduce((sum, value) => sum + value, 0)
  return (
    <>
      <PageHeader eyebrow="Your career control room" title="Today, with evidence in view." description="One place for profile coverage, opportunity signals, application momentum, and the next concrete action." actions={<a className="button secondary" href="/api/workspace/export"><FileCheck2 size={16} /> Export my data</a>} />
      <section className="stats-grid">
        <StatCard label="Profile completeness" value={`${Math.round(data.profile_completeness * 100)}%`} detail={`${data.confirmed_evidence} confirmed evidence claims`} tone="cyan" />
        <StatCard label="Portfolio alignment" value={<Score value={data.global_alignment} />} detail={`${Math.round(data.global_alignment_coverage * 100)}% evidence coverage`} tone="violet" />
        <StatCard label="Opportunities in view" value={data.active_opportunities} detail={`${applicationTotal} tracked applications`} tone="amber" />
        <StatCard label="Evidence review" value={data.review_pending} detail="proposals waiting for your decision" tone="green" />
      </section>
      <div className="dashboard-grid">
        <Panel title="Next best moves" subtitle="Prioritized by urgency and what you control" actions={<Link to="/pipeline" className="text-button">Open pipeline <ArrowRight /></Link>}>
          {data.upcoming_tasks.length ? <div className="task-list">{data.upcoming_tasks.map((task) => <article key={task.id}><span className={`task-kind kind-${task.kind}`}>{task.kind === 'meeting' ? <CalendarClock /> : <CircleDashed />}</span><div><b>{task.title}</b><small>{task.kind} · {dateLabel(task.due_at ?? task.starts_at)}</small></div><span className="status-badge">Upcoming</span></article>)}</div> : <EmptyState title="The runway is clear" description="Add a deadline, meeting, or task from the pipeline to keep momentum visible." action={<Link className="button secondary" to="/pipeline">Plan an action</Link>} />}
        </Panel>
        <Panel title="Readiness pulse" subtitle="Truthful signals across the evidence system">
          <div className="pulse-list">
            <Link to="/profile"><span><FileCheck2 /></span><div><b>Evidence inbox</b><small>{data.review_pending ? `${data.review_pending} items need review` : 'All proposals have a decision'}</small></div><ArrowRight /></Link>
            <Link to="/matches"><span><Radar /></span><div><b>Opportunity fit</b><small>{data.global_alignment === undefined ? 'Add evidence before drawing conclusions' : 'Inspect gaps and uncertainty'}</small></div><ArrowRight /></Link>
            <Link to="/opportunities"><span><Sparkles /></span><div><b>Search landscape</b><small>{data.active_opportunities} active signals in your own dataset</small></div><ArrowRight /></Link>
          </div>
        </Panel>
        <Panel title="Application flow" subtitle="Current state, never a judgment of your value" className="span-two">
          {applicationTotal ? <div className="stage-ribbon">{Object.entries(data.applications_by_stage).map(([stage, count]) => <div key={stage}><span><CheckCircle2 /></span><b>{count}</b><small>{stage}</small></div>)}</div> : <EmptyState title="No applications tracked yet" description="Save an opportunity, review its alignment, then add it to your candidate-owned pipeline." action={<Link className="button primary" to="/opportunities">Capture an opportunity</Link>} />}
        </Panel>
      </div>
      <p className="semantic-note"><Radar /> Scores show alignment to saved requirements and confirmed evidence. They are not hiring probabilities.</p>
    </>
  )
}
