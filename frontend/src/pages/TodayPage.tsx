import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarClock, Check, CircleUserRound, FileCheck2, Gauge, Info, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import { ErrorState, Loading } from '../components/Primitives'
import { RoleMap } from '../components/RoleMap'
import { SalaryBand, type Compensation } from '../components/SalaryBand'
import { useI18n } from '../i18n'
import { ACTIVE_STAGES, buildJourneys, calendarItems, capitalize } from '../pipeline'
import { attentionItems, rolePoints, type AttentionItem } from '../today'
import type { Application, CareerTask, Dashboard, MatchRun, Opportunity, Skill, StageEvent } from '../types'

/**
 * Today, as a workbench: see docs/design/today-workbench-adr-0071.md.
 *
 * The page it replaces opened on a marketing headline and a guided workflow that was complete
 * for this workspace, and overflowed by 587px at 1280x800. Its "next best moves" listed tasks
 * only, so with none recorded it was an empty state while three applications waited in their
 * stage, and no role's fit or salary ask appeared anywhere on it.
 */

export function TodayPage() {
  const { formatDate, plural, t } = useI18n()
  const [now] = useState(() => Date.now())
  const [selectedRole, setSelectedRole] = useState<string>()
  const today = useQuery({ queryKey: ['today'], queryFn: () => api<Dashboard>('/api/workspace/today') })
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api<MatchRun[]>('/api/matches') })
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/api/pipeline/applications') })
  const events = useQuery({ queryKey: ['pipeline-events'], queryFn: () => api<StageEvent[]>('/api/pipeline/events') })
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<CareerTask[]>('/api/pipeline/tasks') })
  const skills = useQuery({ queryKey: ['skills'], queryFn: () => api<Skill[]>('/api/profile/skills') })

  const opportunityMap = useMemo(() => new Map((opportunities.data ?? []).map((item) => [item.id, item])), [opportunities.data])
  const latestRun = useMemo(() => {
    const out = new Map<string, MatchRun>()
    for (const run of matches.data ?? []) if (!out.has(run.opportunity_id)) out.set(run.opportunity_id, run)
    return out
  }, [matches.data])
  const journeys = useMemo(() => buildJourneys(applications.data ?? [], events.data ?? [], opportunityMap, latestRun, now), [applications.data, events.data, opportunityMap, latestRun, now])
  const roles = useMemo(() => rolePoints(opportunities.data ?? [], latestRun, journeys), [opportunities.data, latestRun, journeys])

  const queries = [today, opportunities, matches, applications, events, tasks, skills]
  if (queries.some((query) => query.isPending)) return <Loading label={t('Building your career control room')} />
  const error = queries.find((query) => query.error)?.error
  if (error || !today.data || !tasks.data || !skills.data || !events.data || !applications.data) return <ErrorState error={error} retry={() => queries.forEach((query) => query.refetch())} />

  const data = today.data
  const attention = attentionItems(journeys, tasks.data, data.review_pending, skills.data, now)
  const recent = calendarItems(events.data, tasks.data, applications.data, opportunityMap)
    .dated.filter((item) => Date.parse(item.at) <= now)
    .slice(-6)
    .reverse()
  const byFit = [...roles.placed].sort((a, b) => b.fit - a.fit)
  const selected = roles.placed.find((point) => point.id === selectedRole) ?? byFit[0]
  const selectedRoleData = selected ? opportunityMap.get(selected.id) : undefined
  const applicationTotal = Object.values(data.applications_by_stage).reduce((sum, value) => sum + value, 0)
  const backed = skills.data.filter((skill) => skill.evidence_count > 0).length
  const waited = (days?: number) => (days === undefined ? '' : days === 0 ? t('today') : plural(days, '{count} day', '{count} days'))
  const day = (value: string) => formatDate(value, { day: 'numeric', month: 'short' })

  // The guided workflow only while there is something left to set up.
  const setup = [
    { done: data.profile_completeness >= 0.25 || data.confirmed_evidence > 0, title: t('Build a trusted profile'), to: '/profile', icon: <CircleUserRound aria-hidden /> },
    { done: data.active_opportunities > 0, title: t('Capture a target role'), to: '/opportunities', icon: <BriefcaseBusiness aria-hidden /> },
    { done: data.global_alignment != null, title: t('Run an evidence match'), to: '/matches', icon: <Gauge aria-hidden /> },
    { done: applicationTotal > 0 || data.upcoming_tasks.length > 0, title: t('Plan the next move'), to: '/pipeline', icon: <CalendarClock aria-hidden /> },
  ]
  const setupLeft = setup.filter((step) => !step.done).length

  const attentionText = (item: AttentionItem) => {
    switch (item.kind) {
      case 'application':
        return {
          title: item.title,
          detail: [item.context, item.stage ? `${capitalize(t(item.stage))} · ${waited(item.days)}` : null].filter(Boolean).join(' · '),
          // It opens the application; the move itself is confirmed there.
          action: item.next ? t('Next: {stage}', { stage: t(item.next) }) : undefined,
        }
      case 'overdue':
        return { title: item.title, detail: [t('Overdue since {date}', { date: item.at ? day(item.at) : '' }), item.context].filter(Boolean).join(' · ') }
      case 'due':
        return { title: item.title, detail: [item.at ? formatDate(item.at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '', item.context].filter(Boolean).join(' · ') }
      case 'review':
        return { title: plural(item.count ?? 0, '{count} evidence proposal waits for your decision', '{count} evidence proposals wait for your decision'), detail: t('Confirm or reject them in the profile') }
      case 'evidence':
        return { title: t('{count} of {total} skills have no confirmed evidence', { count: item.count ?? 0, total: item.total ?? 0 }), detail: t('Link a confirmed claim to each, or they cannot answer a requirement') }
    }
  }

  return (
    <div className="page-contained workbench today-page">
      <header className="workbench-bar">
        <h1>{t('Today')}</h1>
        <span className="today-date">{capitalize(formatDate(new Date(now), { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
        <a className="ob-action today-export" href="/api/workspace/export">
          <FileCheck2 aria-hidden /> {t('Export my data')}
        </a>
      </header>

      <div className="td">
        {setupLeft ? (
          <ol className="td-setup" aria-label={t('Guided workflow')}>
            {setup.map((step) => (
              <li key={step.to} className={step.done ? 'done' : ''}>
                <Link to={step.to}>
                  {step.done ? <Check aria-hidden /> : step.icon} {step.title}
                </Link>
              </li>
            ))}
          </ol>
        ) : null}

        <dl className="td-figures">
          <div className="fit" title={t('Across roles, weighted by evidence coverage')}>
            <dt>{t('Portfolio fit')}</dt>
            <dd>{data.global_alignment == null ? '\u2013' : `${Math.round(data.global_alignment * 100)}%`}</dd>
            <small>{plural(roles.placed.length + roles.unplaced.length, 'across {count} role', 'across {count} roles')}</small>
          </div>
          <div>
            <dt>{t('Roles in view')}</dt>
            <dd>{data.active_opportunities}</dd>
            <small>{plural(roles.placed.length, '{count} on the map', '{count} on the map')}</small>
          </div>
          <div className="apps">
            <dt>{t('Applications')}</dt>
            <dd>{applicationTotal}</dd>
            <span className="td-stack" aria-hidden>
              {ACTIVE_STAGES.filter((stage) => data.applications_by_stage[stage]).map((stage) => (
                <i key={stage} className={`stage-${stage}`} style={{ flexGrow: data.applications_by_stage[stage] }} />
              ))}
            </span>
            <small>
              {ACTIVE_STAGES.filter((stage) => data.applications_by_stage[stage])
                .map((stage) => `${data.applications_by_stage[stage]} ${t(stage)}`)
                .join(' · ') || t('None tracked yet')}
            </small>
          </div>
          <div>
            <dt>{t('Confirmed claims')}</dt>
            <dd>{data.confirmed_evidence}</dd>
            <small>{plural(data.review_pending, '{count} to review', '{count} to review')}</small>
          </div>
          <div className="skills">
            <dt>{t('Skills with evidence')}</dt>
            <dd>
              {backed}
              <span>/{skills.data.length}</span>
            </dd>
            <span className="td-share" aria-hidden>
              <i style={{ width: `${skills.data.length ? (backed / skills.data.length) * 100 : 0}%` }} />
            </span>
          </div>
        </dl>

        <div className="td-main">
          <section className="td-map" aria-label={t('Roles by fit and salary ask')}>
            <header>
              <h2>{t('Roles by fit and salary ask')}</h2>
              <ul className="td-legend">
                {roles.placed.some((point) => point.stage === null) ? <li className="stage-untracked">{t('Not tracked')}</li> : null}
                {ACTIVE_STAGES.filter((stage) => roles.placed.some((point) => point.stage === stage)).map((stage) => (
                  <li key={stage} className={`stage-${stage}`}>
                    {capitalize(t(stage))}
                  </li>
                ))}
                <li className="td-legend-band" title={t('Bar: ask range; line behind: market central range; tick: floor')}>
                  <Info aria-hidden /> {t('How to read')}
                </li>
              </ul>
            </header>
            {roles.placed.length ? (
              <RoleMap points={roles.placed} selectedId={selected?.id} onSelect={setSelectedRole} />
            ) : (
              <p className="ad-empty">{t('No role has both a match run and a researched salary band yet.')}</p>
            )}
            {selected ? (
              <article className="td-role" aria-label={selected.title}>
                <header>
                  <span className={`ad-stage stage-${selected.stage ?? 'untracked'}`}>{selected.stage ? capitalize(t(selected.stage)) : t('Not tracked')}</span>
                  <h3 title={`${selected.title} \u00b7 ${selected.employer}`}>
                    {selected.title} <span className="td-role-employer">{selected.employer}</span>
                  </h3>
                  <Link className="ob-action" to={`/opportunities?role=${selected.id}`}>
                    <ArrowUpRight aria-hidden /> {t('Open role')}
                  </Link>
                  {selected.applicationId ? (
                    <Link className="ob-action" to={`/pipeline?application=${selected.applicationId}`}>
                      <ArrowRight aria-hidden /> {t('Open application')}
                    </Link>
                  ) : null}
                </header>
                <dl className="td-role-figures">
                  <div className="fit">
                    <dt>{t('Fit')}</dt>
                    <dd>{selected.fit}%</dd>
                  </div>
                  <div>
                    <dt>{t('Met')}</dt>
                    <dd>
                      {selected.met}
                      <span>/{selected.total}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Gaps')}</dt>
                    <dd className={selected.gaps ? 'warn' : 'clear'}>{selected.gaps}</dd>
                  </div>
                  <div>
                    <dt>{t('In stage')}</dt>
                    <dd>{selected.stage ? waited(selected.daysInStage) : '–'}</dd>
                  </div>
                </dl>
                <SalaryBand compensation={selectedRoleData?.compensation as Compensation} variant="strip" />
              </article>
            ) : null}
            {roles.unplaced.length ? (
              <p className="td-unplaced">
                {t('Not drawn, missing a match run or a salary band: {roles}', { roles: roles.unplaced.map((item) => item.title).join(', ') })}
              </p>
            ) : null}
          </section>

          <aside className="td-side">
            <section className="td-attention">
              <h2>
                {t('Needs attention')} <b>{attention.length}</b>
              </h2>
              {attention.length ? (
                <ul>
                  {attention.map((item) => {
                    const text = attentionText(item)
                    return (
                      <li key={item.id} className={`ta-item kind-${item.kind}${item.stage ? ` stage-${item.stage}` : ''}`} data-kind={item.kind}>
                        <Link to={item.to}>
                          <i aria-hidden>{item.kind === 'overdue' ? <AlertTriangle /> : item.kind === 'review' || item.kind === 'evidence' ? <ShieldCheck /> : null}</i>
                          <span>
                            <b>{text.title}</b>
                            <small>{text.detail}</small>
                          </span>
                          {'action' in text && text.action ? <em>{text.action}</em> : <ArrowRight aria-hidden />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="ad-empty">{t('Nothing needs attention: no open application, task or evidence waits on you.')}</p>
              )}
            </section>
            <section className="td-recent">
              <h2>{t('Recent activity')}</h2>
              {recent.length ? (
                <ul>
                  {recent.map((item) => (
                    <li key={item.id} className={`cc-item kind-${item.kind}${item.kind === 'stage' ? ` stage-${item.detail}` : ''}`}>
                      <i aria-hidden />
                      <span>
                        <b>{item.kind === 'stage' ? (item.started ? t('Started tracking') : t('Moved to {stage}', { stage: t(item.detail) })) : item.detail}</b>
                        <small>{[item.kind === 'stage' || item.title !== item.detail ? item.title : null, day(item.at)].filter(Boolean).join(' · ')}</small>
                      </span>
                      {item.applicationId ? (
                        <Link className="ob-action" to={`/pipeline?application=${item.applicationId}`}>
                          {t('Open')}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ad-empty">{t('Nothing recorded yet.')}</p>
              )}
            </section>
          </aside>
        </div>
        <p className="td-note">{t('Scores show alignment to saved requirements and confirmed evidence. They are not hiring probabilities.')}</p>
      </div>
    </div>
  )
}
