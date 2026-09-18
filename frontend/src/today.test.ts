import { describe, expect, it } from 'vitest'
import { buildJourneys } from './pipeline'
import { attentionItems, dodge, forwardMove, mapDomain, niceTicks, placeLabels, rolePoints, type Rect } from './today'
import type { Application, CareerTask, MatchRun, Opportunity, Skill, StageEvent } from './types'

const NOW = Date.parse('2026-09-18T12:00:00Z')

function opportunity(id: string, pay: Record<string, number> | null, title = `Role ${id}`): Opportunity {
  return {
    id, title, employer: `Employer ${id}`, description: '', source_kind: 'manual', industry: '', area: '', seniority: '', location: '', remote_mode: 'unspecified',
    compensation: pay ?? {}, status: 'watching', version: 1, structured_data: {}, requirements: [], created_at: '', updated_at: '',
  }
}
function run(opportunityId: string, score: number, statuses: string[] = []): MatchRun {
  return {
    id: `run-${opportunityId}`, opportunity_id: opportunityId, policy_version: 'match-v1.1.0', input_digest: '', score, lower_bound: score, upper_bound: score, coverage: 1, eligibility: 'unknown', components: {},
    assessments: statuses.map((status, index) => ({ requirement_id: `r${index}`, label: '', category: '', importance: 'required', status, evidence_ids: [], explanation: '' })),
    created_at: '',
  }
}
function application(id: string, opportunityId: string, stage: string): Application {
  return { id, opportunity_id: opportunityId, stage, channel: 'direct', notes: '', created_at: '2026-09-10T12:00:00Z', updated_at: '' }
}
function event(id: string, applicationId: string, to: string, at: string, from: string | null = null): StageEvent {
  return { id, application_id: applicationId, from_stage: from, to_stage: to, note: '', occurred_at: at }
}
const skill = (id: string, evidence: number): Skill => ({ id, name: id, normalized_name: id, level: 90, years: 3, confidence: 0.9, category: 'data', evidence_count: evidence, evidence_ids: [] })

const OPPS = [
  opportunity('a', { ask_low: 6_500_000, ask_high: 7_500_000, floor: 5_500_000, central_low: 6_000_000, central_high: 7_000_000 }),
  opportunity('b', { ask_low: 7_000_000, ask_high: 8_000_000, floor: 6_000_000 }),
  opportunity('c', null),
  opportunity('d', { ask_low: 6_500_000, ask_high: 7_000_000 }),
]
const RUNS = new Map([run('a', 0.96, ['met', 'met', 'missing']), run('b', 0.82, ['met', 'partial']), run('c', 0.9)].map((item) => [item.opportunity_id, item]))
const APPS = [application('x', 'a', 'applied'), application('y', 'b', 'saved'), application('z', 'd', 'rejected')]
const EVENTS = [
  event('e1', 'x', 'saved', '2026-09-14T12:00:00Z'),
  event('e2', 'x', 'applied', '2026-09-15T12:00:00Z', 'saved'),
  event('e3', 'y', 'saved', '2026-09-17T12:00:00Z'),
]
const JOURNEYS = buildJourneys(APPS, EVENTS, new Map(OPPS.map((item) => [item.id, item])), RUNS, NOW)

describe('role map', () => {
  it('places roles with a fit and an ask, and lists the rest', () => {
    const { placed, unplaced } = rolePoints(OPPS, RUNS, JOURNEYS)
    expect(placed.map((point) => point.id)).toEqual(['a', 'b'])
    // c has a fit and no band; d has a band and no match run.
    expect(unplaced.map((item) => item.id)).toEqual(['c', 'd'])
    const a = placed[0]!
    expect(a).toMatchObject({ fit: 96, askLow: 6_500_000, askHigh: 7_500_000, floor: 5_500_000, centralLow: 6_000_000, stage: 'applied', applicationId: 'x', daysInStage: 3, met: 2, total: 3, gaps: 1 })
    expect(placed[1]!.stage).toBe('saved')
  })

  it('draws an untracked role without a stage', () => {
    const { placed } = rolePoints(OPPS, RUNS, [])
    expect(placed.every((point) => point.stage === null && point.applicationId === undefined)).toBe(true)
  })

  it('spans fit from a round value below the lowest to 100, and pay across every mark', () => {
    const { placed } = rolePoints(OPPS, RUNS, JOURNEYS)
    const domain = mapDomain(placed)
    expect(domain.fit).toEqual([80, 100])
    expect(domain.pay[0]).toBeLessThan(5_500_000)
    expect(domain.pay[1]).toBeGreaterThan(8_000_000)
  })

  it('labels axes with round steps', () => {
    expect(niceTicks(70, 100, 6)).toEqual([70, 75, 80, 85, 90, 95, 100])
    expect(niceTicks(5_300_000, 8_200_000, 5)).toEqual([6_000_000, 7_000_000, 8_000_000])
    // A quarter step is not round; the next round step up is a half.
    expect(niceTicks(0, 1, 4)).toEqual([0, 0.5, 1])
    expect(niceTicks(3, 3)).toEqual([3])
  })

  it('places crowded labels clear of every range, floor and other label, inside the plot', () => {
    const bounds = { left: 64, right: 560, top: 0, bottom: 300 }
    // The live cluster: three roles within four points of fit at the right edge, one apart.
    const marks = [
      { id: 'ultranav', text: 'Ultranav', cx: 180, cy: 100, top: 60, bottom: 140, floorY: 220 },
      { id: 'confidencial', text: 'Empresa Confidencial', cx: 470, cy: 120, top: 80, bottom: 160, floorY: 240 },
      { id: 'altia', text: 'Altia', cx: 540, cy: 140, top: 120, bottom: 160, floorY: 240 },
      { id: 'global66', text: 'Global66', cx: 558, cy: 120, top: 80, bottom: 160, floorY: 240 },
    ]
    const labels = placeLabels(marks, bounds)
    const rects = [...labels.values()].map((label) => label.rect)
    const ranges = marks.map((mark) => ({ left: mark.cx - 6, right: mark.cx + 6, top: mark.top - 4, bottom: mark.bottom + 4 }))
    const hit = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    for (const rect of rects) {
      expect(rect.left).toBeGreaterThanOrEqual(bounds.left)
      expect(rect.right).toBeLessThanOrEqual(bounds.right)
      expect(ranges.some((range) => hit(rect, range))).toBe(false)
    }
    rects.forEach((a, i) => rects.forEach((b, j) => i < j && expect(hit(a, b)).toBe(false)))
    // An isolated role keeps its label on the right.
    expect(labels.get('ultranav')!.anchor).toBe('start')
  })

  it('sets roles at the same fit side by side and leaves distant ones in place', () => {
    const offsets = dodge([500, 500, 505, 300], 18)
    expect(offsets[3]).toBe(0)
    const cluster = [offsets[0]!, offsets[1]!, offsets[2]!].sort((a, b) => a - b)
    expect(cluster).toEqual([-18, 0, 18])
    expect(dodge([100, 200])).toEqual([0, 0])
  })
})

describe('attention', () => {
  const tasks: CareerTask[] = [
    { id: 't1', kind: 'task', title: 'Send references', notes: '', contact: {}, application_id: 'x', due_at: '2026-09-17T12:00:00Z' },
    { id: 't2', kind: 'meeting', title: 'Screening call', notes: '', contact: {}, application_id: 'x', starts_at: '2026-09-20T15:00:00Z' },
    { id: 't3', kind: 'task', title: 'Far away', notes: '', contact: {}, due_at: '2026-10-30T12:00:00Z' },
    { id: 't4', kind: 'task', title: 'Done already', notes: '', contact: {}, due_at: '2026-09-16T12:00:00Z', completed_at: '2026-09-16T13:00:00Z' },
    { id: 't5', kind: 'task', title: 'Undated', notes: '', contact: {} },
  ]
  const items = attentionItems(JOURNEYS, tasks, 2, [skill('s1', 1), skill('s2', 0), skill('s3', 0)], NOW)

  it('orders overdue tasks, open applications by wait, tasks due this week, review, evidence', () => {
    expect(items.map((item) => item.kind)).toEqual(['overdue', 'application', 'application', 'due', 'review', 'evidence'])
    expect(items[0]).toMatchObject({ title: 'Send references', context: 'Role a', to: '/pipeline?application=x' })
    expect(items[1]).toMatchObject({ stage: 'applied', days: 3, next: 'screening' })
    expect(items[2]).toMatchObject({ stage: 'saved', days: 1, next: 'preparing' })
    expect(items[3]).toMatchObject({ title: 'Screening call' })
    expect(items[4]).toMatchObject({ count: 2 })
    expect(items[5]).toMatchObject({ count: 2, total: 3 })
  })

  it('leaves out closed applications, completed, distant and undated tasks', () => {
    expect(items.some((item) => item.id === 'application-z')).toBe(false)
    expect(items.some((item) => ['task-t3', 'task-t4', 'task-t5'].includes(item.id))).toBe(false)
  })

  it('offers the forward move the state machine allows', () => {
    expect(forwardMove('saved')).toBe('preparing')
    expect(forwardMove('interview')).toBe('offer')
    expect(forwardMove('offer')).toBe('accepted')
    expect(forwardMove('rejected')).toBeUndefined()
  })
})
