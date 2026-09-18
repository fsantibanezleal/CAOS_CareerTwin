import { useMemo, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { useI18n } from '../i18n'
import { compact } from '../money'
import { ACTIVE_STAGES, capitalize, journeySegments, openTasksFor, timeScale, type Journey, type SortKey } from '../pipeline'
import type { CareerTask, Contact } from '../types'
import type { JourneyView, TrackMode } from '../useJourneyView'

/**
 * Applications as journeys, under a stage strip that counts and filters.
 *
 * The board this replaces was nine columns of at least 230px that scrolled sideways on every
 * screen, and showed where an application was but never how it got there or for how long. Each
 * row carries the role, its fit and salary ask, and its journey drawn one of two ways: across
 * the six open stages, aligned to the strip, with the date each was reached; or along the
 * calendar, one bar per stage as long as the time spent in it, which shows the pace of the
 * search and what has been waiting.
 */

export function PipelineJourneys({
  journeys,
  view,
  tasks,
  contacts,
  selectedId,
  onSelect,
  summary,
}: {
  journeys: Journey[]
  view: JourneyView
  tasks: CareerTask[]
  contacts: Contact[]
  selectedId?: string
  onSelect: (id: string) => void
  summary?: ReactNode
}) {
  const { formatDate, plural, t } = useI18n()
  const [now] = useState(() => Date.now())
  const open = journeys.filter((journey) => !journey.closed)
  const closedCount = journeys.length - open.length
  const counts = new Map(ACTIVE_STAGES.map((stage) => [stage as string, open.filter((journey) => journey.application.stage === stage).length]))
  const countOf = (stage: string) => counts.get(stage) ?? 0
  const most = Math.max(1, ...counts.values())
  const scale = useMemo(() => timeScale(view.visible, now), [view.visible, now])
  const day = (value: string | number) => formatDate(new Date(value), { day: 'numeric', month: 'short' })
  const waited = (days: number) => (days === 0 ? t('today') : plural(days, '{count} day', '{count} days'))
  const todayTick = new Date(now).setHours(0, 0, 0, 0)
  const modes: Array<[TrackMode, string]> = [
    ['stages', t('Stages')],
    ['dates', t('Dates')],
  ]

  return (
    <section className="pj" aria-label={t('Applications by stage')}>
      <div className="pj-controls">
        <div className="pj-mode" role="group" aria-label={t('Draw journeys by')}>
          {modes.map(([key, label]) => (
            <button key={key} type="button" className={view.mode === key ? 'active' : ''} aria-pressed={view.mode === key} onClick={() => view.setMode(key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="pj-sort">
          {t('Sort')}
          <select value={view.sort} onChange={(event) => view.setSort(event.target.value as SortKey)}>
            <option value="stage">{t('Furthest along')}</option>
            <option value="fit">{t('Best fit')}</option>
            <option value="ask">{t('Highest ask')}</option>
            <option value="waiting">{t('Longest waiting')}</option>
          </select>
        </label>
        <label className="cw-toggle">
          <input type="checkbox" checked={view.showClosed} onChange={(event) => view.setShowClosed(event.target.checked)} />
          {t('Show closed')} <span className="pj-closed-count">{closedCount}</span>
        </label>
      </div>

      <div className="pj-scroll">
        {/* The strip and the axis share the rows' scroll container, so they stay aligned with
            the tracks below whether or not a scrollbar is showing. */}
        <div className="pj-sticky">
          <div className="pj-strip" role="group" aria-label={t('Filter by stage')}>
            {ACTIVE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={`pj-stage stage-${stage}${view.stage === stage ? ' active' : ''}${countOf(stage) ? '' : ' empty'}`}
                aria-pressed={view.stage === stage}
                data-count={countOf(stage)}
                onClick={() => view.setStage(view.stage === stage ? null : stage)}
              >
                <span>{t(stage)}</span>
                <b>{countOf(stage)}</b>
                <i aria-hidden>
                  <em style={{ width: `${(countOf(stage) / most) * 100}%` }} />
                </i>
              </button>
            ))}
          </div>
          {view.mode === 'dates' && view.visible.length ? (
            <div className="pj-axis" aria-hidden>
              {scale.ticks.map((tick) => (
                <span key={tick} className={tick === todayTick ? 'today' : undefined} style={{ left: `${scale.at(tick)}%` }}>
                  {tick === todayTick ? t('Today') : day(tick)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {view.visible.length ? (
          <ol className="pj-rows">
            {view.visible.map((journey) => {
              const { application, opportunity } = journey
              const selected = application.id === selectedId
              const people = contacts.filter((contact) => contact.application_id === application.id).length
              const next = openTasksFor(tasks, application.id)[0]
              const nextAt = next?.starts_at ?? next?.due_at
              const ask = journey.askLow !== null && journey.askHigh !== null ? `${compact(journey.askLow)}–${compact(journey.askHigh)}` : null
              return (
                <li key={application.id}>
                  <button
                    type="button"
                    className={`pj-row${selected ? ' selected' : ''}${journey.closed ? ' closed' : ''}`}
                    aria-current={selected}
                    data-application={application.id}
                    data-stage={application.stage}
                    data-fit={journey.fit ?? ''}
                    onClick={() => onSelect(application.id)}
                  >
                    <span className="pj-head">
                      <span className="pj-role">
                        <b title={opportunity?.title}>{opportunity?.title ?? t('Opportunity removed')}</b>
                        <small title={opportunity?.employer}>{opportunity?.employer || t('Employer not specified')}</small>
                      </span>
                      {journey.closed ? (
                        <span className={`pj-terminal stage-${application.stage}`}>
                          {capitalize(t(application.stage))} {day(journey.enteredAt)}
                        </span>
                      ) : null}
                      <span className="pj-fit" title={t('Fit is evidence alignment, never a hiring probability.')}>
                        {journey.fit === null ? '–' : `${journey.fit}%`} <small>{t('fit')}</small>
                      </span>
                      <span className="pj-ask" title={t('Salary ask')}>{ask ?? t('No band')}</span>
                    </span>
                    {view.mode === 'dates' ? <DateTrack journey={journey} scale={scale} now={now} day={day} waited={waited} /> : <StageTrack journey={journey} day={day} waited={waited} />}
                    <span className="pj-meta">
                      {[
                        t(application.channel),
                        people ? plural(people, '{count} contact', '{count} contacts') : null,
                        next ? t('Next: {task}', { task: nextAt ? `${next.title}, ${day(nextAt)}` : next.title }) : journey.closed ? null : t('No next step recorded'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="pj-empty">{view.stage ? t('No applications in {stage}', { stage: t(view.stage) }) : t('No applications')}</p>
        )}
      </div>
      <footer className="pj-foot">
        {summary ? <span className="pj-summary">{summary}</span> : null}
        {view.mode === 'dates' ? (
          <span className="pj-note">
            <Info aria-hidden /> {t('Bars: time in each stage. Dashed line: now.')}
          </span>
        ) : null}
      </footer>
    </section>
  )
}

type Format = { day: (value: string | number) => string; waited: (days: number) => string }

/** Six steps aligned to the strip: a dot where the application has been, and when. */
function StageTrack({ journey, day, waited }: { journey: Journey } & Format) {
  const { formatDate, t } = useI18n()
  return (
    <span className="pj-track" aria-label={t('Stages reached')}>
      {ACTIVE_STAGES.map((stage, index) => {
        const at = journey.reached[stage]
        const current = !journey.closed && journey.application.stage === stage
        return (
          <span
            key={stage}
            className={`pj-step stage-${stage}${at ? ' reached' : ''}${current ? ' current' : ''}${index < journey.furthest ? ' passed' : ''}`}
            title={at ? `${capitalize(t(stage))}: ${formatDate(at, { dateStyle: 'medium' })}` : undefined}
          >
            <i aria-hidden />
            {at ? (
              <small>
                {day(at)}
                {current ? <em>{waited(journey.daysInStage)}</em> : null}
              </small>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}

/** The journey along the calendar: one bar per stage, as long as the time spent in it. */
function DateTrack({ journey, scale, now, day, waited }: { journey: Journey; scale: ReturnType<typeof timeScale>; now: number } & Format) {
  const { t } = useI18n()
  const segments = journeySegments(journey, now)
  const current = segments.at(-1)
  const labelAt = current ? Math.min(100, Math.max(0, scale.at(current.from))) : 0
  return (
    <span className="pj-gantt" aria-label={t('Time in each stage')}>
      {scale.ticks.map((tick) => (
        <i key={tick} className="pj-grid" style={{ left: `${scale.at(tick)}%` }} aria-hidden />
      ))}
      {journey.closed ? null : <i className="pj-now" style={{ left: `${scale.at(now)}%` }} aria-hidden />}
      {segments.map((segment, index) => (
        <span
          key={`${segment.stage}-${index}`}
          className={`pj-seg stage-${segment.stage}`}
          style={{ left: `${scale.at(segment.from)}%`, width: `${scale.at(segment.to) - scale.at(segment.from)}%` }}
          title={`${capitalize(t(segment.stage))}: ${day(segment.from)}${segment.to > segment.from ? ` – ${day(segment.to)}` : ''}`}
        />
      ))}
      {journey.events.map((event) => (
        <b key={event.id} className={`pj-dot stage-${event.to_stage}`} style={{ left: `${scale.at(Date.parse(event.occurred_at))}%` }} aria-hidden />
      ))}
      {current ? (
        // Kept inside the track: the label's own offset follows its position along the axis.
        <small className="pj-seg-label" style={{ left: `${labelAt}%`, transform: `translateX(-${labelAt}%)` }}>
          <b>{capitalize(t(current.stage))}</b> {day(current.from)}
          {journey.closed ? null : ` · ${waited(journey.daysInStage)}`}
        </small>
      ) : null}
    </span>
  )
}
