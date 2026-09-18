import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'
import { useI18n } from '../i18n'
import { calendarItems, capitalize, dayKey, monthWeeks, type CalendarItem } from '../pipeline'
import type { Application, CareerTask, Opportunity, StageEvent } from '../types'
import { ErrorState } from './Primitives'

/**
 * The search on a calendar: stage changes that happened, and tasks, meetings and deadlines to
 * come. The agenda it replaces listed tasks only, so with none recorded it was an empty state
 * while every dated stage change sat unread in the history.
 */

const DAY = 86_400_000
const MARKS_PER_DAY = 3

export function CareerCalendar({
  events,
  tasks,
  applications,
  opportunities,
  onOpenApplication,
  onAddTask,
  importControl,
}: {
  events: StageEvent[]
  tasks: CareerTask[]
  applications: Application[]
  opportunities: Map<string, Opportunity>
  onOpenApplication: (applicationId: string) => void
  onAddTask: () => void
  importControl?: ReactNode
}) {
  const { formatDate, plural, t } = useI18n()
  const client = useQueryClient()
  const [now] = useState(() => new Date())
  const todayKey = dayKey(now)
  const [shown, setShown] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }))
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const complete = useMutation({
    mutationFn: (id: string) => api(`/api/pipeline/tasks/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['tasks'] })
      client.invalidateQueries({ queryKey: ['today'] })
    },
  })

  const { dated, unscheduled } = useMemo(() => calendarItems(events, tasks, applications, opportunities), [events, tasks, applications, opportunities])
  const byDay = useMemo(() => {
    const out = new Map<string, CalendarItem[]>()
    for (const item of dated) {
      const key = dayKey(item.at)
      out.set(key, [...(out.get(key) ?? []), item])
    }
    return out
  }, [dated])

  const weeks = monthWeeks(shown.year, shown.month)
  const monthLabel = formatDate(new Date(shown.year, shown.month, 1), { month: 'long', year: 'numeric' })
  const [y = 1970, m = 1, d = 1] = selectedDay.split('-').map(Number)
  const selectedDate = new Date(y, m - 1, d)
  const dayItems = byDay.get(selectedDay) ?? []
  const openDated = dated.filter((item) => item.taskId && !item.done)
  const within = (days: number) => openDated.filter((item) => Date.parse(item.at) >= now.getTime() && Date.parse(item.at) <= now.getTime() + days * DAY).length
  const overdue = openDated.filter((item) => Date.parse(item.at) < now.getTime()).length
  const openUnscheduled = unscheduled.filter((task) => !task.completed_at)
  const upcoming = dated.filter((item) => item.kind !== 'stage' && !item.done && Date.parse(item.at) >= now.getTime()).slice(0, 5)
  const recent = dated.filter((item) => Date.parse(item.at) < now.getTime()).slice(-5).reverse()

  const shift = (delta: number) => setShown(({ year, month }) => ({ year: month + delta < 0 ? year - 1 : month + delta > 11 ? year + 1 : year, month: (month + delta + 12) % 12 }))
  const markLabel = (item: CalendarItem) => (item.kind === 'stage' ? t(item.detail) : item.kind === 'deadline' ? t('Deadline') : item.detail)
  const itemHeading = (item: CalendarItem) =>
    item.kind === 'stage' ? (item.started ? t('Started tracking') : t('Moved to {stage}', { stage: t(item.detail) })) : item.kind === 'deadline' ? t('Application deadline') : item.detail

  // One item, in the day list or in the coming and recent lists; the latter carry their date.
  const renderItem = (item: CalendarItem, dated: boolean) => (
    <li key={item.id} className={`cc-item kind-${item.kind}${item.kind === 'stage' ? ` stage-${item.detail}` : ''}${item.done ? ' done' : ''}`}>
      <i aria-hidden />
      <span>
        <b>{itemHeading(item)}</b>
        <small>
          {[item.kind === 'stage' || item.kind === 'deadline' || item.title !== item.detail ? item.title : null, formatDate(item.at, dated ? { dateStyle: 'medium' } : { timeStyle: 'short' })]
            .filter(Boolean)
            .join(' \u00b7 ')}
        </small>
        {item.note && !dated ? <p>{item.note}</p> : null}
      </span>
      <span className="cc-item-actions">
        {item.taskId && !item.done ? (
          <button type="button" className="icon-button" aria-label={t('Complete {task}', { task: item.detail })} disabled={complete.isPending} onClick={() => complete.mutate(item.taskId!)}>
            <Check />
          </button>
        ) : null}
        {item.applicationId ? (
          <button type="button" className="ob-action" onClick={() => onOpenApplication(item.applicationId!)}>
            {t('Open')}
          </button>
        ) : null}
      </span>
    </li>
  )

  return (
    <div className="cc">
      <section className="cc-month" aria-label={monthLabel}>
        <header className="cc-head">
          <h2>{monthLabel}</h2>
          <div className="cc-nav">
            <button type="button" className="icon-button" aria-label={t('Previous month')} onClick={() => shift(-1)}>
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="ob-action"
              onClick={() => {
                setShown({ year: now.getFullYear(), month: now.getMonth() })
                setSelectedDay(todayKey)
              }}
            >
              {t('Today')}
            </button>
            <button type="button" className="icon-button" aria-label={t('Next month')} onClick={() => shift(1)}>
              <ChevronRight />
            </button>
          </div>
          <ul className="cc-legend" aria-label={t('Legend')}>
            <li className="kind-stage">{t('Stage reached')}</li>
            <li className="kind-task">{t('Task')}</li>
            <li className="kind-meeting">{t('Meeting')}</li>
            <li className="kind-deadline">{t('Deadline')}</li>
          </ul>
          <div className="cc-io">
            {importControl}
            <a className="ob-action" href="/api/pipeline/calendar.ics">
              <Download aria-hidden /> {t('Export')}
            </a>
          </div>
        </header>
        <div className="cc-grid" style={{ gridTemplateRows: `auto repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {(weeks[0] ?? []).map((date) => (
            <span key={`head-${date.getDay()}`} className="cc-weekday">
              {formatDate(date, { weekday: 'short' })}
            </span>
          ))}
          {weeks.flat().map((date) => {
            const key = dayKey(date)
            const items = byDay.get(key) ?? []
            const outside = date.getMonth() !== shown.month
            return (
              <button
                key={key}
                type="button"
                className={`cc-day${outside ? ' outside' : ''}${key === todayKey ? ' today' : ''}${key === selectedDay ? ' selected' : ''}`}
                aria-pressed={key === selectedDay}
                aria-label={`${formatDate(date, { dateStyle: 'full' })}, ${plural(items.length, '{count} item', '{count} items')}`}
                data-day={key}
                data-items={items.length}
                onClick={() => setSelectedDay(key)}
              >
                <span className="cc-date">{date.getDate()}</span>
                <span className="cc-marks">
                  {items.slice(0, MARKS_PER_DAY).map((item) => (
                    <span key={item.id} className={`cc-mark kind-${item.kind}${item.kind === 'stage' ? ` stage-${item.detail}` : ''}${item.done ? ' done' : ''}`} title={`${markLabel(item)}: ${item.title}`}>
                      {markLabel(item)}
                    </span>
                  ))}
                  {items.length > MARKS_PER_DAY ? <span className="cc-more">{t('+{count} more', { count: items.length - MARKS_PER_DAY })}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <aside className="cc-pane" aria-label={t('Selected day')}>
        <header>
          <h3>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <button type="button" className="ob-action" onClick={onAddTask}>
            {t('Add task')}
          </button>
        </header>
        <dl className="cc-horizon">
          <div>
            <dt>{t('Next 7 days')}</dt>
            <dd>{within(7)}</dd>
          </div>
          <div>
            <dt>{t('Next 30 days')}</dt>
            <dd>{within(30)}</dd>
          </div>
          <div>
            <dt>{t('Unscheduled')}</dt>
            <dd>{openUnscheduled.length}</dd>
          </div>
          <div className={overdue ? 'warn' : ''}>
            <dt>{t('Overdue')}</dt>
            <dd>{overdue}</dd>
          </div>
        </dl>
        <div className="cc-pane-body">
          <section className="cc-section">
            <h4>{t('On this day')}</h4>
            {dayItems.length ? <ul className="cc-items">{dayItems.map((item) => renderItem(item, false))}</ul> : <p className="ad-empty">{t('Nothing recorded on this day.')}</p>}
          </section>
          <section className="cc-section">
            <h4>{t('Coming up')}</h4>
            {upcoming.length ? <ul className="cc-items">{upcoming.map((item) => renderItem(item, true))}</ul> : <p className="ad-empty">{t('Nothing scheduled ahead. Add a task, meeting or deadline.')}</p>}
          </section>
          {recent.length ? (
            <section className="cc-section">
              <h4>{t('Recent activity')}</h4>
              <ul className="cc-items">{recent.map((item) => renderItem(item, true))}</ul>
            </section>
          ) : null}
          {openUnscheduled.length ? (
            <section className="cc-unscheduled">
              <h4>{t('Unscheduled tasks')}</h4>
              <ul className="cc-items">
                {openUnscheduled.map((task) => (
                  <li key={task.id} className={`cc-item kind-${task.kind === 'meeting' ? 'meeting' : 'task'}`}>
                    <i aria-hidden />
                    <span>
                      <b>{task.title}</b>
                      <small>{capitalize(t(task.kind))}</small>
                    </span>
                    <span className="cc-item-actions">
                      <button type="button" className="icon-button" aria-label={t('Complete {task}', { task: task.title })} disabled={complete.isPending} onClick={() => complete.mutate(task.id)}>
                        <Check />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {complete.error ? <ErrorState error={complete.error} /> : null}
        </div>
      </aside>
    </div>
  )
}
