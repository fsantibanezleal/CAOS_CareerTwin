import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildJourneys, calendarItems, dayKey, journeySegments, monthWeeks, openTasksFor, orderEvents, sortJourneys, timeScale, TRANSITIONS } from './pipeline'
import type { Application, CareerTask, MatchRun, Opportunity, StageEvent } from './types'

const NOW = Date.parse('2026-09-18T12:00:00Z')

function application(id: string, stage: string, extra: Partial<Application> = {}): Application {
  return { id, opportunity_id: `opp-${id}`, stage, channel: 'direct', notes: '', created_at: '2026-09-10T12:00:00Z', updated_at: '2026-09-18T04:00:00Z', ...extra }
}
function opportunity(id: string, askHigh?: number, extra: Partial<Opportunity> = {}): Opportunity {
  return {
    id: `opp-${id}`, title: `Role ${id}`, employer: `Employer ${id}`, description: '', source_kind: 'manual', industry: '', area: '', seniority: '', location: '', remote_mode: 'unspecified',
    compensation: askHigh === undefined ? {} : { ask_low: askHigh - 1_000_000, ask_high: askHigh }, status: 'watching', version: 1, structured_data: {}, requirements: [], created_at: '', updated_at: '', ...extra,
  }
}
function run(id: string, score: number): MatchRun {
  return { id: `run-${id}`, opportunity_id: `opp-${id}`, policy_version: 'match-v1.1.0', input_digest: '', score, lower_bound: score, upper_bound: score, coverage: 1, eligibility: 'unknown', components: {}, assessments: [], created_at: '' }
}
function event(id: string, applicationId: string, from: string | null, to: string, at: string): StageEvent {
  return { id, application_id: applicationId, from_stage: from, to_stage: to, note: '', occurred_at: at }
}

// The live search, reduced: two saved, one preparing, one applied, with same-instant events.
const APPS = [application('a', 'saved'), application('b', 'saved'), application('c', 'preparing'), application('d', 'applied', { applied_at: '2026-09-15T12:00:00Z' })]
const EVENTS = [
  event('z1', 'd', 'preparing', 'applied', '2026-09-15T12:00:00Z'),
  // Same instant, stored in the wrong order: the path must still read saved, then preparing.
  event('y2', 'd', 'saved', 'preparing', '2026-09-14T12:00:00Z'),
  event('y1', 'd', null, 'saved', '2026-09-14T12:00:00Z'),
  event('x2', 'c', 'saved', 'preparing', '2026-09-16T12:00:00Z'),
  event('x1', 'c', null, 'saved', '2026-09-16T12:00:00Z'),
  event('w1', 'a', null, 'saved', '2026-09-17T12:00:00Z'),
  event('v1', 'b', null, 'saved', '2026-09-17T12:00:00Z'),
]
const OPPS = new Map(['a', 'b', 'c', 'd'].map((id, index) => [`opp-${id}`, opportunity(id, 6_000_000 + index * 500_000)]))
const RUNS = new Map([run('a', 0.99), run('b', 0.82), run('c', 0.96), run('d', 0.99)].map((item) => [item.opportunity_id, item]))

describe('journeys', () => {
  const journeys = buildJourneys(APPS, EVENTS, OPPS, RUNS, NOW)
  const byId = new Map(journeys.map((journey) => [journey.application.id, journey]))

  it('orders same-instant events by the stage path, not by identifier', () => {
    expect(orderEvents(EVENTS.filter((item) => item.application_id === 'd')).map((item) => item.to_stage)).toEqual(['saved', 'preparing', 'applied'])
  })

  it('records when each stage was reached and how far the application got', () => {
    const applied = byId.get('d')!
    expect(applied.reached).toEqual({ saved: '2026-09-14T12:00:00Z', preparing: '2026-09-14T12:00:00Z', applied: '2026-09-15T12:00:00Z' })
    expect(applied.furthest).toBe(2)
    expect(applied.enteredAt).toBe('2026-09-15T12:00:00Z')
    expect(applied.daysInStage).toBe(3)
    expect(byId.get('a')!.furthest).toBe(0)
    expect(byId.get('a')!.daysInStage).toBe(1)
  })

  it('carries fit as a percentage and the salary ask from the role', () => {
    expect(byId.get('b')!.fit).toBe(82)
    expect(byId.get('d')!.askHigh).toBe(7_500_000)
    expect(byId.get('d')!.askLow).toBe(6_500_000)
  })

  it('counts days in a stage by calendar day, not by elapsed 24 hours', () => {
    const entered = new Date(2026, 8, 17, 9, 0).toISOString()
    const read = new Date(2026, 8, 18, 2, 0).getTime()
    const [journey] = buildJourneys([application('y', 'saved')], [event('y1', 'y', null, 'saved', entered)], new Map(), new Map(), read)
    expect(journey!.daysInStage).toBe(1)
    const [same] = buildJourneys([application('z', 'saved')], [event('z1', 'z', null, 'saved', new Date(2026, 8, 18, 0, 30).toISOString())], new Map(), new Map(), read)
    expect(same!.daysInStage).toBe(0)
  })

  it('places an application without recorded events in its current stage', () => {
    const legacy = buildJourneys([application('e', 'interview')], [], new Map(), new Map(), NOW)[0]!
    expect(legacy.reached).toEqual({ interview: '2026-09-10T12:00:00Z' })
    expect(legacy.furthest).toBe(4)
    expect(legacy.fit).toBeNull()
    expect(legacy.daysInStage).toBe(8)
  })

  it('sorts by stage, fit, ask and waiting time', () => {
    const ids = (key: Parameters<typeof sortJourneys>[1]) => sortJourneys(journeys, key).map((journey) => journey.application.id)
    expect(ids('stage')).toEqual(['d', 'c', 'a', 'b'])
    expect(ids('fit')).toEqual(['d', 'a', 'c', 'b'])
    expect(ids('ask')).toEqual(['d', 'c', 'b', 'a'])
    expect(ids('waiting')).toEqual(['d', 'c', 'a', 'b'])
  })

  it('puts closed applications last when sorting by waiting time', () => {
    const closed = buildJourneys(
      [application('r', 'rejected'), application('s', 'saved')],
      [event('r1', 'r', null, 'saved', '2026-08-01T12:00:00Z'), event('r2', 'r', 'saved', 'withdrawn', '2026-08-02T12:00:00Z'), event('s1', 's', null, 'saved', '2026-09-17T12:00:00Z')],
      new Map(), new Map(), NOW,
    )
    expect(sortJourneys(closed, 'waiting').map((journey) => journey.application.id)).toEqual(['s', 'r'])
    expect(closed[0]!.closed).toBe(true)
  })
})

describe('time in stage', () => {
  const journeys = buildJourneys(APPS, EVENTS, OPPS, RUNS, NOW)
  const applied = journeys.find((journey) => journey.application.id === 'd')!

  it('splits a journey into the time spent in each stage, the open one running to now', () => {
    const segments = journeySegments(applied, NOW)
    expect(segments.map((segment) => segment.stage)).toEqual(['saved', 'preparing', 'applied'])
    // Saved and moved to preparation at the same instant: a stage with no duration.
    expect(segments[0]!.to - segments[0]!.from).toBe(0)
    expect(segments[1]!.to - segments[1]!.from).toBe(86_400_000)
    expect(segments[2]!.to).toBe(NOW)
  })

  it('ends a closed journey at its closing event', () => {
    const [closed] = buildJourneys(
      [application('r', 'rejected')],
      [event('r1', 'r', null, 'saved', '2026-08-01T12:00:00Z'), event('r2', 'r', 'saved', 'rejected', '2026-08-05T12:00:00Z')],
      new Map(), new Map(), NOW,
    )
    const segments = journeySegments(closed!, NOW)
    expect(segments.at(-1)).toEqual({ stage: 'rejected', from: Date.parse('2026-08-05T12:00:00Z'), to: Date.parse('2026-08-05T12:00:00Z') })
  })

  it('spans the first event to the end of today on local midnights, with uncrowded ticks', () => {
    const scale = timeScale(journeys, NOW)
    const first = new Date('2026-09-14T12:00:00Z')
    first.setHours(0, 0, 0, 0)
    expect(scale.start).toBe(first.getTime())
    expect(scale.end).toBeGreaterThan(NOW)
    expect(scale.end - NOW).toBeLessThanOrEqual(86_400_000)
    expect(scale.at(scale.start)).toBe(0)
    expect(scale.at(scale.end)).toBe(100)
    expect(scale.ticks.length).toBeLessThanOrEqual(8)
    expect(scale.ticks.every((tick) => new Date(tick).getHours() === 0)).toBe(true)
    // A long search is labelled by whole weeks, not by crowded days.
    const [old] = buildJourneys([application('o', 'saved')], [event('o1', 'o', null, 'saved', '2026-07-01T12:00:00Z')], new Map(), new Map(), NOW)
    const weeks = timeScale([old!], NOW).ticks
    expect(weeks.length).toBeLessThanOrEqual(8)
    expect(Math.round((weeks[1]! - weeks[0]!) / 86_400_000) % 7).toBe(0)
  })
})

describe('transitions', () => {
  it('mirror the server state machine exactly', () => {
    const source = readFileSync(resolve(process.cwd(), '../backend/careertwin/api/pipeline.py'), 'utf8')
    const block = source.slice(source.indexOf('TRANSITIONS: dict'), source.indexOf('}\n\n', source.indexOf('TRANSITIONS: dict')))
    const server: Record<string, string[]> = {}
    for (const match of block.matchAll(/"(\w+)": (?:\{([^}]*)\}|set\(\))/g)) {
      server[match[1]!] = (match[2] ?? '').split(',').map((item) => item.trim().replace(/"/g, '')).filter(Boolean).sort()
    }
    const client = Object.fromEntries(Object.entries(TRANSITIONS).map(([stage, next]) => [stage, [...next].sort()]))
    expect(Object.keys(server).length).toBe(9)
    expect(client).toEqual(server)
  })
})

describe('calendar', () => {
  const task = (id: string, extra: Partial<CareerTask>): CareerTask => ({ id, kind: 'task', title: `Task ${id}`, notes: '', contact: {}, ...extra })
  const TASKS = [
    task('t1', { kind: 'meeting', application_id: 'd', starts_at: '2026-09-22T15:00:00Z', due_at: '2026-09-22T16:00:00Z' }),
    task('t2', { due_at: '2026-09-20T12:00:00Z', completed_at: '2026-09-19T12:00:00Z' }),
    task('t3', {}),
  ]

  it('dates stage changes, tasks and posting deadlines, and keeps undated tasks apart', () => {
    const opps = new Map(OPPS)
    opps.set('opp-x', opportunity('x', undefined, { deadline_at: '2026-09-30T12:00:00Z' }))
    const { dated, unscheduled } = calendarItems(EVENTS, TASKS, APPS, opps)
    expect(dated.filter((item) => item.kind === 'stage')).toHaveLength(EVENTS.length)
    const meeting = dated.find((item) => item.taskId === 't1')!
    expect(meeting.kind).toBe('meeting')
    expect(meeting.at).toBe('2026-09-22T15:00:00Z')
    expect(meeting.title).toBe('Role d')
    expect(dated.find((item) => item.taskId === 't2')!.done).toBe(true)
    expect(dated.find((item) => item.kind === 'deadline')!.title).toBe('Role x')
    expect(unscheduled.map((item) => item.id)).toEqual(['t3'])
    expect(dated.map((item) => Date.parse(item.at))).toEqual([...dated.map((item) => Date.parse(item.at))].sort((a, b) => a - b))
  })

  it('lists open tasks for one application, soonest first', () => {
    const tasks = [task('late', { application_id: 'd', due_at: '2026-10-01T12:00:00Z' }), task('undated', { application_id: 'd' }), task('soon', { application_id: 'd', due_at: '2026-09-20T12:00:00Z' }), task('other', { application_id: 'a', due_at: '2026-09-19T12:00:00Z' })]
    expect(openTasksFor(tasks, 'd').map((item) => item.id)).toEqual(['soon', 'late', 'undated'])
  })

  it('lays a month out in whole weeks, Monday first', () => {
    const september = monthWeeks(2026, 8)
    expect(september).toHaveLength(5)
    expect(dayKey(september[0]![0]!)).toBe('2026-08-31')
    expect(dayKey(september[4]![6]!)).toBe('2026-10-04')
    expect(september.every((week) => week.length === 7 && week[0]!.getDay() === 1)).toBe(true)
    // February 2027 starts on a Monday and ends on a Sunday: exactly four weeks.
    expect(monthWeeks(2027, 1)).toHaveLength(4)
  })
})
