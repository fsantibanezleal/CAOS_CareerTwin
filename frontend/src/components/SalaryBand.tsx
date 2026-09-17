import { Info } from 'lucide-react'
import { useI18n } from '../i18n'

/**
 * Compensation band for an opportunity.
 *
 * `Opportunity.compensation` has always existed on the model and was never rendered
 * anywhere in the interface, so researched salary data sat in the database invisible
 * to the person who needs it while negotiating.
 *
 * The band is drawn as a range with three marks rather than a single number, because
 * a single number invites anchoring on it. Floor, central range and target ask are
 * distinct decisions and are shown as distinct marks.
 */

export type Compensation = {
  currency?: string
  period?: string
  basis?: string
  floor?: number
  central_low?: number
  central_high?: number
  ask_low?: number
  ask_high?: number
  confidence?: string
  researched?: string
  note?: string
  source?: string
}

function compact(value: number, currency: string): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const text = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)
    return `${text}M ${currency}`
  }
  return `${Math.round(value / 1000)}K ${currency}`
}

export function SalaryBand({ compensation }: { compensation?: Compensation | null }) {
  const { t } = useI18n()
  if (!compensation || compensation.floor === undefined) return null

  const currency = compensation.currency ?? 'CLP'
  const floor = compensation.floor ?? 0
  const centralLow = compensation.central_low ?? floor
  const centralHigh = compensation.central_high ?? centralLow
  const askLow = compensation.ask_low ?? centralHigh
  const askHigh = compensation.ask_high ?? askLow

  // Pad the scale so the floor mark is not flush against the left edge.
  const min = floor * 0.92
  const max = askHigh * 1.06
  const at = (value: number) => ((value - min) / (max - min)) * 100

  const basis = compensation.basis === 'net' ? t('net') : compensation.basis === 'gross' ? t('gross') : ''
  const period = compensation.period === 'month' ? t('monthly') : compensation.period ?? ''

  return (
    <section className="sb" aria-label={t('Compensation band')}>
      <header>
        <h4>{t('Compensation band')}</h4>
        <span className={`sb-confidence ${compensation.confidence ?? 'unknown'}`}>
          {t(compensation.confidence === 'researched' ? 'researched' : 'comparable')}
        </span>
      </header>

      <div className="sb-scale">
        <span className="sb-range central" style={{ left: `${at(centralLow)}%`, width: `${at(centralHigh) - at(centralLow)}%` }} />
        <span className="sb-range ask" style={{ left: `${at(askLow)}%`, width: `${Math.max(at(askHigh) - at(askLow), 1)}%` }} />
        <span className="sb-mark floor" style={{ left: `${at(floor)}%` }} title={t('Floor')} />
      </div>

      <dl className="sb-figures">
        <div>
          <dt>{t('Floor')}</dt>
          <dd>{compact(floor, currency)}</dd>
        </div>
        <div>
          <dt>{t('Central')}</dt>
          <dd>
            {compact(centralLow, currency)} &ndash; {compact(centralHigh, currency)}
          </dd>
        </div>
        <div className="emphasis">
          <dt>{t('Ask')}</dt>
          <dd>
            {compact(askLow, currency)} &ndash; {compact(askHigh, currency)}
          </dd>
        </div>
      </dl>

      <p className="sb-basis">
        {[period, basis].filter(Boolean).join(', ')}
        {compensation.researched ? ` · ${t('researched')} ${compensation.researched}` : ''}
      </p>

      {compensation.note ? (
        <p className="sb-note">
          <Info aria-hidden /> {compensation.note}
        </p>
      ) : null}
      {compensation.source ? <p className="sb-source">{compensation.source}</p> : null}
    </section>
  )
}
