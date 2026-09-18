import { useState } from 'react'
import { useI18n } from '../i18n'
import { compact } from '../money'
import { capitalize } from '../pipeline'
import { dodge, mapDomain, niceTicks, placeLabels, type RolePoint } from '../today'
import { useElementSize } from '../useElementSize'

/**
 * Every role on the two axes a candidate weighs it by: fit across, salary ask up.
 *
 * Each role draws its ask as a range, the market's central range as a thinner line behind it and
 * its floor as a tick, coloured by where its application stands. Drawn in pixels from the
 * container's measured size, so labels keep their size at every screen. Roles at nearly the same
 * fit are set side by side, and each label takes the first place beside, above or below its range
 * that is clear of every other mark.
 */

const MARGIN = { top: 18, right: 16, bottom: 44, left: 64 }
const GAP = 18
const LABEL_CHARS = 20

export function RoleMap({ points, selectedId, onSelect }: { points: RolePoint[]; selectedId?: string; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const { width, height } = size
  const domain = mapDomain(points)
  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right)
  const plotH = Math.max(1, height - MARGIN.top - MARGIN.bottom)
  const x = (fit: number) => MARGIN.left + ((fit - domain.fit[0]) / (domain.fit[1] - domain.fit[0])) * plotW
  const y = (pay: number) => MARGIN.top + plotH - ((pay - domain.pay[0]) / (domain.pay[1] - domain.pay[0])) * plotH
  const fitTicks = niceTicks(domain.fit[0], domain.fit[1], Math.max(3, Math.floor(plotW / 70)))
  const payTicks = niceTicks(domain.pay[0], domain.pay[1], Math.max(3, Math.floor(plotH / 56)))
  const offsets = dodge(points.map((point) => x(point.fit)), GAP)
  const placed = points.map((point, index) => ({ point, cx: x(point.fit) + (offsets[index] ?? 0), cy: y((point.askLow + point.askHigh) / 2) }))
  const label = (text: string) => (text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}\u2026` : text)
  const labels = placeLabels(
    placed.map(({ point, cx, cy }) => ({ id: point.id, text: label(point.employer || point.title), cx, cy, top: y(point.askHigh), bottom: y(point.askLow), floorY: point.floor === undefined ? undefined : y(point.floor) })),
    { left: MARGIN.left + 2, right: width - 2, top: 0, bottom: MARGIN.top + plotH },
  )
  const hovered = placed.find((item) => item.point.id === hover)

  return (
    <div className="rm" ref={ref}>
      {width > 0 && height > 0 ? (
        <svg width={width} height={height} role="group" aria-label={t('Roles by fit and salary ask')}>
          <g className="rm-grid" aria-hidden>
            {fitTicks.map((tick) => (
              <g key={`x${tick}`} className="rm-tick rm-x" data-value={tick}>
                <line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={MARGIN.top + plotH} />
                <text x={x(tick)} y={MARGIN.top + plotH + 18}>{`${tick}%`}</text>
              </g>
            ))}
            {payTicks.map((tick) => (
              <g key={`y${tick}`} className="rm-tick rm-y" data-value={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(tick)} y2={y(tick)} />
                <text x={MARGIN.left - 8} y={y(tick) + 4}>{compact(tick)}</text>
              </g>
            ))}
            <text className="rm-axis rm-axis-x" x={MARGIN.left + plotW} y={MARGIN.top + plotH + 38}>{t('Fit')}</text>
            <text className="rm-axis rm-axis-y" x={MARGIN.left - 8} y={MARGIN.top - 6}>{t('Ask, monthly')}</text>
          </g>
          {placed.map(({ point, cx, cy }) => {
            const selected = point.id === selectedId
            const text = label(point.employer || point.title)
            const place = labels.get(point.id)
            return (
              <g
                key={point.id}
                className={`rm-role stage-${point.stage ?? 'untracked'}${selected ? ' selected' : ''}${hover === point.id ? ' hover' : ''}`}
                data-role={point.id}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                aria-label={t('{title}, {employer}: {fit}% fit, ask {low} to {high}', { title: point.title, employer: point.employer, fit: point.fit, low: compact(point.askLow), high: compact(point.askHigh) })}
                onClick={() => onSelect(point.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(point.id)
                  }
                }}
                onMouseEnter={() => setHover(point.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(point.id)}
                onBlur={() => setHover(null)}
              >
                {/* A wide transparent target: a 6px bar is hard to hit. */}
                <rect className="rm-hit" x={cx - 12} y={y(point.askHigh) - 12} width={24} height={y(point.askLow) - y(point.askHigh) + 24} />
                {point.centralLow !== undefined && point.centralHigh !== undefined ? <line className="rm-central" x1={cx} x2={cx} y1={y(point.centralLow)} y2={y(point.centralHigh)} /> : null}
                <line className="rm-ask" x1={cx} x2={cx} y1={y(point.askLow)} y2={y(point.askHigh)} />
                {point.floor !== undefined ? <line className="rm-floor" x1={cx - 7} x2={cx + 7} y1={y(point.floor)} y2={y(point.floor)} /> : null}
                <circle className="rm-dot" cx={cx} cy={cy} r={selected ? 7 : 5} />
                {place ? (
                  <text className="rm-label" textAnchor={place.anchor} x={place.x} y={place.y}>
                    {text}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      ) : null}
      {hovered ? (
        <div className="rm-tip" style={{ left: Math.min(Math.max(8, hovered.cx + 14), Math.max(8, width - 250)), top: Math.max(4, hovered.cy - 64) }} role="status">
          <b>{hovered.point.title}</b>
          <span>{hovered.point.employer}</span>
          <span>
            {t('{fit}% fit', { fit: hovered.point.fit })} {'·'} {t('Ask')} {compact(hovered.point.askLow)}{'–'}{compact(hovered.point.askHigh)}
          </span>
          <span>{hovered.point.stage ? capitalize(t(hovered.point.stage)) : t('Not tracked')}</span>
        </div>
      ) : null}
    </div>
  )
}
