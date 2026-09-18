import type { Application, CareerTask, MatchRun, Opportunity, StageEvent } from './types'

/**
 * Pipeline model: what the board, the calendar and the people view read.
 *
 * Kept apart from the components so the journeys, their ordering and the calendar's items are
 * tested directly rather than through rendered markup.
 */

/** Stages an application moves through while it is open, in order. */
export const ACTIVE_STAGES = ['saved', 'preparing', 'applied', 'screening', 'interview', 'offer'] as const
/** Terminal stages: no transition leaves them. */
export const CLOSED_STAGES = ['accepted', 'rejected', 'withdrawn'] as const
const ALL_STAGES: readonly string[] = [...ACTIVE_STAGES, ...CLOSED_STAGES]

/** Legal transitions, mirroring `TRANSITIONS` in backend/careertwin/api/pipeline.py. */
export const TRANSITIONS: Record<string, readonly string[]> = {
  saved: ['preparing', 'withdrawn'],
  preparing: ['saved', 'applied', 'withdrawn'],
  applied: ['screening', 'interview', 'rejected', 'withdrawn'],
  screening: ['interview', 'offer', 'rejected', 'withdrawn'],
  interview: ['interview', 'offer', 'rejected', 'withdrawn'],
  offer: ['accepted', 'rejected', 'withdrawn'],
  accepted: [],
  rejected: [],
  withdrawn: [],
}

/** Stage names are lower case in both languages; a chip that shows one alone starts upper case. */
export const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1)

export const isClosed = (stage: string): boolean => (CLOSED_STAGES as readonly string[]).includes(stage)

const DAY = 86_400_000

/** Local midnight at or before an instant. */
const midnight = (time: number): number => new Date(time).setHours(0, 0, 0, 0)

export type Journey = {
  application: Application
  opportunity?: Opportunity
  run?: MatchRun
  /** This application's stage events, oldest first. */
  events: StageEvent[]
  /** The first time each stage was reached. */
  reached: Record<string, string>
  /** Index in ACTIVE_STAGES of the furthest open stage reached. */
  furthest: number
  closed: boolean
  /** When the application entered its current stage. */
  enteredAt: string
  /** Whole days in the current stage, or since closing. */
  daysInStage: number
  /** Fit as a whole percentage, when a match run exists. */
  fit: number | null
  askLow: number | null
  askHigh: number | null
}

/**
 * Oldest first. Events recorded at the same instant (a role saved and moved to preparation on
 * the same day) are ordered by the stage path, not by their random identifiers.
 */
export function orderEvents(events: StageEvent[]): StageEvent[] {
  const rank = (event: StageEvent) => (event.from_stage ? ALL_STAGES.indexOf(event.to_stage) + 1 : 0)
  return [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || rank(a) - rank(b))
}

export function buildJourneys(
  applications: Application[],
  events: StageEvent[],
  opportunities: Map<string, Opportunity>,
  runs: Map<string, MatchRun>,
  now: number = Date.now(),
): Journey[] {
  const byApplication = new Map<string, StageEvent[]>()
  for (const event of events) {
    const list = byApplication.get(event.application_id) ?? []
    list.push(event)
    byApplication.set(event.application_id, list)
  }
  return applications.map((application) => {
    const own = orderEvents(byApplication.get(application.id) ?? [])
    const reached: Record<string, string> = {}
    for (const event of own) if (!(event.to_stage in reached)) reached[event.to_stage] = event.occurred_at
    // An application is always in its current stage, even without a recorded event for it.
    if (!(application.stage in reached)) reached[application.stage] = application.created_at
    let furthest = 0
    ACTIVE_STAGES.forEach((stage, index) => {
      if (stage in reached) furthest = index
    })
    const enteredAt = [...own].reverse().find((event) => event.to_stage === application.stage)?.occurred_at ?? reached[application.stage] ?? application.created_at
    const opportunity = opportunities.get(application.opportunity_id)
    const run = runs.get(application.opportunity_id)
    const pay = (opportunity?.compensation ?? {}) as { ask_low?: number; ask_high?: number }
    return {
      application,
      opportunity,
      run,
      events: own,
      reached,
      furthest,
      closed: isClosed(application.stage),
      enteredAt,
      // Rounded, not floored: a day that crosses a daylight-saving change is 23 or 25 hours.
      daysInStage: Math.max(0, Math.round((midnight(now) - midnight(Date.parse(enteredAt))) / DAY)),
      fit: run?.score != null ? Math.round(run.score * 100) : null,
      askLow: typeof pay.ask_low === 'number' ? pay.ask_low : null,
      askHigh: typeof pay.ask_high === 'number' ? pay.ask_high : null,
    }
  })
}

export type SortKey = 'stage' | 'fit' | 'ask' | 'waiting'

const stageRank = (journey: Journey) => (journey.closed ? -1 : ACTIVE_STAGES.indexOf(journey.application.stage as (typeof ACTIVE_STAGES)[number]))
const byFit = (a: Journey, b: Journey) => (b.fit ?? -1) - (a.fit ?? -1)

export function sortJourneys(journeys: Journey[], key: SortKey): Journey[] {
  const compare: Record<SortKey, (a: Journey, b: Journey) => number> = {
    stage: (a, b) => stageRank(b) - stageRank(a) || byFit(a, b),
    fit: (a, b) => byFit(a, b) || stageRank(b) - stageRank(a),
    ask: (a, b) => (b.askHigh ?? -1) - (a.askHigh ?? -1) || byFit(a, b),
    // Open applications first: a closed one is not waiting on anybody.
    waiting: (a, b) => Number(a.closed) - Number(b.closed) || b.daysInStage - a.daysInStage || byFit(a, b),
  }
  return [...journeys].sort((a, b) => compare[key](a, b) || a.application.id.localeCompare(b.application.id))
}

/** Open tasks for an application, soonest first; undated ones last. */
export function openTasksFor(tasks: CareerTask[], applicationId: string): CareerTask[] {
  const when = (task: CareerTask) => Date.parse(task.starts_at ?? task.due_at ?? '') || Number.POSITIVE_INFINITY
  return tasks.filter((task) => task.application_id === applicationId && !task.completed_at).sort((a, b) => when(a) - when(b))
}

// ------------------------------------------------------------ time in stage

export type Segment = { stage: string; from: number; to: number }

/** The stretches of time an application spent in each stage; the open one runs to now. */
export function journeySegments(journey: Journey, now: number = Date.now()): Segment[] {
  const { events } = journey
  if (!events.length) {
    const from = Date.parse(journey.enteredAt)
    return [{ stage: journey.application.stage, from, to: journey.closed ? from : Math.max(from, now) }]
  }
  return events.map((event, index) => {
    const from = Date.parse(event.occurred_at)
    const next = events[index + 1]
    const to = next ? Date.parse(next.occurred_at) : isClosed(event.to_stage) ? from : now
    return { stage: event.to_stage, from, to: Math.max(from, to) }
  })
}

export type TimeScale = {
  start: number
  end: number
  /** Local midnights to label, at most `maxTicks` of them. */
  ticks: number[]
  /** Position of an instant along the axis, in percent. */
  at: (time: number) => number
}

/** A day-aligned axis from the first recorded event of the given journeys to the end of today. */
export function timeScale(journeys: Journey[], now: number = Date.now(), maxTicks = 8): TimeScale {
  const times = journeys.flatMap((journey) => [...journey.events.map((event) => Date.parse(event.occurred_at)), Date.parse(journey.enteredAt)])
  const first = new Date(Math.min(now, ...times))
  first.setHours(0, 0, 0, 0)
  const last = new Date(Math.max(now, ...times))
  last.setHours(0, 0, 0, 0)
  last.setDate(last.getDate() + 1)
  const start = first.getTime()
  const end = last.getTime()
  const days = Math.max(1, Math.round((end - start) / DAY))
  const ticks: number[] = []
  if (days <= 90) {
    // Daily up to two weeks, then whole weeks, so labels never crowd.
    const step = days <= 14 ? Math.ceil(days / maxTicks) : Math.ceil(days / maxTicks / 7) * 7
    for (const cursor = new Date(first); cursor.getTime() <= end; cursor.setDate(cursor.getDate() + step)) ticks.push(cursor.getTime())
  } else {
    const step = Math.ceil(days / 30 / maxTicks)
    for (const cursor = new Date(first.getFullYear(), first.getMonth() + 1, 1); cursor.getTime() <= end; cursor.setMonth(cursor.getMonth() + step)) ticks.push(cursor.getTime())
  }
  return { start, end, ticks, at: (time: number) => ((time - start) / (end - start)) * 100 }
}

// ------------------------------------------------------------------ calendar

export type CalendarItem = {
  id: string
  kind: 'stage' | 'task' | 'meeting' | 'deadline' | 'reminder'
  at: string
  /** The role, or the task's own title for a general task. */
  title: string
  /** What happened or is due: the stage reached, or the task. */
  detail: string
  applicationId?: string
  taskId?: string
  done?: boolean
  note?: string
  /** A stage item that opened the application's tracking rather than moving it. */
  started?: boolean
}

/** Local calendar day of an instant, as YYYY-MM-DD. */
export function dayKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function calendarItems(
  events: StageEvent[],
  tasks: CareerTask[],
  applications: Application[],
  opportunities: Map<string, Opportunity>,
): { dated: CalendarItem[]; unscheduled: CareerTask[] } {
  const roleOf = new Map(applications.map((application) => [application.id, opportunities.get(application.opportunity_id)]))
  const dated: CalendarItem[] = []
  for (const event of orderEvents(events)) {
    const role = roleOf.get(event.application_id)
    dated.push({
      id: `event-${event.id}`,
      kind: 'stage',
      at: event.occurred_at,
      title: role?.title ?? '',
      detail: event.to_stage,
      applicationId: event.application_id,
      note: event.note,
      started: !event.from_stage,
    })
  }
  const unscheduled: CareerTask[] = []
  for (const task of tasks) {
    const at = task.starts_at ?? task.due_at
    if (!at) {
      unscheduled.push(task)
      continue
    }
    const role = task.application_id ? roleOf.get(task.application_id) : undefined
    dated.push({
      id: `task-${task.id}`,
      kind: task.kind === 'meeting' || task.kind === 'deadline' || task.kind === 'reminder' ? task.kind : 'task',
      at,
      title: role?.title ?? task.title,
      detail: task.title,
      applicationId: task.application_id,
      taskId: task.id,
      done: Boolean(task.completed_at),
      note: task.notes,
    })
  }
  for (const opportunity of opportunities.values()) {
    if (!opportunity.deadline_at) continue
    dated.push({
      id: `deadline-${opportunity.id}`,
      kind: 'deadline',
      at: opportunity.deadline_at,
      title: opportunity.title,
      detail: 'Application deadline',
    })
  }
  dated.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return { dated, unscheduled }
}

/** The weeks covering a month, Monday first, as whole weeks of days. */
export function monthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  const last = new Date(year, month + 1, 0)
  const weeks: Date[][] = []
  for (let cursor = start; cursor <= last || weeks.length === 0; ) {
    const week: Date[] = []
    for (let day = 0; day < 7; day += 1) {
      week.push(cursor)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}
