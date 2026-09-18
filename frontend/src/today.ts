import { ACTIVE_STAGES, TRANSITIONS, type Journey } from './pipeline'
import type { CareerTask, MatchRun, Opportunity, Skill } from './types'

/**
 * Today's model: where each role sits on fit and pay, and what needs attention.
 *
 * Kept apart from the components so the placement, the axes and the attention list are tested
 * directly rather than through rendered markup.
 */

const DAY = 86_400_000

export type RolePoint = {
  id: string
  title: string
  employer: string
  /** Fit as a whole percentage. */
  fit: number
  askLow: number
  askHigh: number
  floor?: number
  centralLow?: number
  centralHigh?: number
  /** Pipeline stage, or null when the role is not tracked. */
  stage: string | null
  applicationId?: string
  daysInStage?: number
  met: number
  total: number
  gaps: number
}

type Pay = { ask_low?: number; ask_high?: number; floor?: number; central_low?: number; central_high?: number }

const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/** Roles with both a fit and a salary ask are placed; the rest are listed as unplaced. */
export function rolePoints(opportunities: Opportunity[], runs: Map<string, MatchRun>, journeys: Journey[]): { placed: RolePoint[]; unplaced: Opportunity[] } {
  const journeyOf = new Map(journeys.map((journey) => [journey.application.opportunity_id, journey]))
  const placed: RolePoint[] = []
  const unplaced: Opportunity[] = []
  for (const opportunity of opportunities) {
    const run = runs.get(opportunity.id)
    const pay = (opportunity.compensation ?? {}) as Pay
    const askLow = num(pay.ask_low)
    const askHigh = num(pay.ask_high)
    if (run?.score == null || askLow === undefined || askHigh === undefined) {
      unplaced.push(opportunity)
      continue
    }
    const journey = journeyOf.get(opportunity.id)
    const assessments = run.assessments ?? []
    placed.push({
      id: opportunity.id,
      title: opportunity.title,
      employer: opportunity.employer,
      fit: Math.round(run.score * 100),
      askLow,
      askHigh,
      floor: num(pay.floor),
      centralLow: num(pay.central_low),
      centralHigh: num(pay.central_high),
      stage: journey?.application.stage ?? null,
      applicationId: journey?.application.id,
      daysInStage: journey?.daysInStage,
      met: assessments.filter((item) => item.status === 'met').length,
      total: assessments.length,
      gaps: assessments.filter((item) => item.status === 'missing' || item.status === 'conflict').length,
    })
  }
  return { placed, unplaced }
}

/** Round steps of 1, 2 or 5 times a power of ten covering [min, max], about `target` of them. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!(max > min)) return [min]
  const raw = (max - min) / Math.max(1, target)
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw) ?? 10 * power
  const ticks: number[] = []
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) ticks.push(Math.round(value / step) * step)
  return ticks
}

export type MapDomain = { fit: [number, number]; pay: [number, number] }

/**
 * Fit runs from a multiple of five just below the lowest fit to 100, so roles a few points apart
 * are drawn apart; pay covers every drawn mark.
 */
export function mapDomain(points: RolePoint[]): MapDomain {
  if (!points.length) return { fit: [0, 100], pay: [0, 1] }
  const lowestFit = Math.min(...points.map((point) => point.fit))
  const fitMin = Math.max(0, Math.min(95, Math.floor((lowestFit - 2) / 5) * 5))
  const marks = points.flatMap((point) => [point.askLow, point.askHigh, point.floor, point.centralLow, point.centralHigh].filter((value): value is number => value !== undefined))
  const low = Math.min(...marks)
  const high = Math.max(...marks)
  const pad = (high - low || high || 1) * 0.08
  return { fit: [fitMin, 100], pay: [Math.max(0, low - pad), high + pad] }
}

/**
 * Horizontal offsets, in pixels, that set points closer than `gap` side by side instead of one
 * over another. Three roles at 96% and 99% fit drew their ranges on the same line.
 */
export function dodge(xs: number[], gap = 18): number[] {
  const order = xs.map((x, index) => ({ x, index })).sort((a, b) => a.x - b.x)
  const offsets = new Array<number>(xs.length).fill(0)
  let cluster: typeof order = []
  const flush = () => {
    cluster.forEach((item, position) => {
      offsets[item.index] = (position - (cluster.length - 1) / 2) * gap
    })
    cluster = []
  }
  for (const item of order) {
    const last = cluster.at(-1)
    if (last && item.x - last.x >= gap) flush()
    cluster.push(item)
  }
  flush()
  return offsets
}

export type Rect = { left: number; right: number; top: number; bottom: number }
export type LabelMark = { id: string; text: string; cx: number; cy: number; top: number; bottom: number; floorY?: number }
export type LabelPlacement = { x: number; y: number; anchor: 'start' | 'end' | 'middle'; rect: Rect }

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * Places each role's label beside, above or below its range, whichever first stays inside the
 * plot and clear of every range, floor tick and label already placed. Crowded roles at the
 * same fit once put one employer's name across its neighbour's bar.
 */
export function placeLabels(marks: LabelMark[], bounds: Rect, charWidth = 7, lineHeight = 14): Map<string, LabelPlacement> {
  const obstacles: Rect[] = marks.flatMap((mark) => [
    { left: mark.cx - 6, right: mark.cx + 6, top: mark.top - 4, bottom: mark.bottom + 4 },
    ...(mark.floorY === undefined ? [] : [{ left: mark.cx - 8, right: mark.cx + 8, top: mark.floorY - 3, bottom: mark.floorY + 3 }]),
  ])
  const placed: Rect[] = []
  const result = new Map<string, LabelPlacement>()
  for (const mark of [...marks].sort((a, b) => a.cx - b.cx)) {
    const w = mark.text.length * charWidth
    const centred = Math.min(Math.max(mark.cx, bounds.left + w / 2), bounds.right - w / 2)
    const beside = (left: number, anchor: 'start' | 'end', x: number): LabelPlacement => ({ x, y: mark.cy + 4, anchor, rect: { left, right: left + w, top: mark.cy - lineHeight + 4, bottom: mark.cy + 4 } })
    const vertical = (baseline: number): LabelPlacement => ({ x: centred, y: baseline, anchor: 'middle', rect: { left: centred - w / 2, right: centred + w / 2, top: baseline - lineHeight + 4, bottom: baseline + 4 } })
    const candidates = [
      beside(mark.cx + 11, 'start', mark.cx + 11),
      beside(mark.cx - 11 - w, 'end', mark.cx - 11),
      vertical(mark.top - 9),
      vertical(mark.bottom + 19),
    ]
    const inside = (rect: Rect) => rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom
    const clear = (rect: Rect) => ![...obstacles, ...placed].some((other) => overlaps(rect, other))
    const choice = candidates.find((candidate) => inside(candidate.rect) && clear(candidate.rect)) ?? candidates.find((candidate) => inside(candidate.rect)) ?? candidates[2]!
    placed.push(choice.rect)
    result.set(mark.id, choice)
  }
  return result
}

// ------------------------------------------------------------------ attention

export type AttentionItem = {
  id: string
  kind: 'overdue' | 'application' | 'due' | 'review' | 'evidence'
  /** The role, the task or the subject. */
  title: string
  /** Employer or task kind, when there is one. */
  context?: string
  stage?: string
  days?: number
  /** The stage an open application can move to next, when it can move forward. */
  next?: string
  at?: string
  count?: number
  total?: number
  to: string
}

/** The next stage forward from the current one, if the state machine allows it. */
export function forwardMove(stage: string): string | undefined {
  const index = ACTIVE_STAGES.indexOf(stage as (typeof ACTIVE_STAGES)[number])
  const next = ACTIVE_STAGES[index + 1]
  if (index < 0) return undefined
  if (next && TRANSITIONS[stage]?.includes(next)) return next
  return TRANSITIONS[stage]?.find((candidate) => candidate === 'accepted')
}

/**
 * What needs attention, from recorded facts only: overdue tasks first, then open applications by
 * how long they have waited, then tasks due within a week, then evidence waiting for a decision,
 * then skills that no confirmed claim backs.
 */
export function attentionItems(journeys: Journey[], tasks: CareerTask[], reviewPending: number, skills: Skill[], now: number): AttentionItem[] {
  const when = (task: CareerTask) => Date.parse(task.starts_at ?? task.due_at ?? '')
  const open = tasks.filter((task) => !task.completed_at && Number.isFinite(when(task)))
  const roleOf = new Map(journeys.map((journey) => [journey.application.id, journey]))
  const taskItem = (task: CareerTask, kind: 'overdue' | 'due'): AttentionItem => {
    const journey = task.application_id ? roleOf.get(task.application_id) : undefined
    return {
      id: `task-${task.id}`,
      kind,
      title: task.title,
      context: journey?.opportunity?.title,
      at: task.starts_at ?? task.due_at,
      to: journey ? `/pipeline?application=${journey.application.id}` : '/pipeline',
    }
  }
  const overdue = open.filter((task) => when(task) < now).sort((a, b) => when(a) - when(b)).map((task) => taskItem(task, 'overdue'))
  const due = open.filter((task) => when(task) >= now && when(task) <= now + 7 * DAY).sort((a, b) => when(a) - when(b)).map((task) => taskItem(task, 'due'))
  const applications = journeys
    .filter((journey) => !journey.closed)
    .sort((a, b) => b.daysInStage - a.daysInStage || (b.fit ?? -1) - (a.fit ?? -1))
    .map<AttentionItem>((journey) => ({
      id: `application-${journey.application.id}`,
      kind: 'application',
      title: journey.opportunity?.title ?? '',
      context: journey.opportunity?.employer,
      stage: journey.application.stage,
      days: journey.daysInStage,
      next: forwardMove(journey.application.stage),
      to: `/pipeline?application=${journey.application.id}`,
    }))
  const items = [...overdue, ...applications, ...due]
  if (reviewPending > 0) items.push({ id: 'review', kind: 'review', title: '', count: reviewPending, to: '/profile' })
  const unbacked = skills.filter((skill) => skill.evidence_count === 0).length
  if (unbacked > 0) items.push({ id: 'evidence', kind: 'evidence', title: '', count: unbacked, total: skills.length, to: '/profile' })
  return items
}
