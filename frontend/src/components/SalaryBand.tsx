import { Info } from 'lucide-react'
import { useI18n } from '../i18n'
import { compact } from '../money'

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


export function SalaryBand({
  compensation,
  variant = 'panel',
}: {
  compensation?: Compensation | null
  /** `strip` is one row, for surfaces whose height belongs to other content. */
  variant?: 'panel' | 'strip'
}) {
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

  const scale = (
    <div className="sb-scale" aria-hidden>
      <span className="sb-range central" style={{ left: `${at(centralLow)}%`, width: `${at(centralHigh) - at(centralLow)}%` }} />
      <span className="sb-range ask" style={{ left: `${at(askLow)}%`, width: `${Math.max(at(askHigh) - at(askLow), 1)}%` }} />
      <span className="sb-mark floor" style={{ left: `${at(floor)}%` }} title={t('Floor')} />
    </div>
  )

  if (variant === 'strip') {
    // The research note and its source are one hover away rather than stacked in layout.
    const detail = [compensation.note, compensation.source].filter(Boolean).join(' \u00b7 ')
    return (
      <section className={`sb-strip ${compensation.confidence ?? 'unknown'}`} aria-label={t('Compensation band')}>
        <span className="sb-strip-label">
          {t('Compensation')}
          <small>{t(compensation.confidence === 'researched' ? 'researched' : 'comparable')}</small>
        </span>
        <dl>
          <div>
            <dt>{t('Floor')}</dt>
            <dd>{compact(floor)}</dd>
          </div>
          <div>
            <dt>{t('Central')}</dt>
            <dd>{compact(centralLow)}&ndash;{compact(centralHigh)}</dd>
          </div>
          <div className="emphasis">
            <dt>{t('Ask')}</dt>
            <dd>{compact(askLow)}&ndash;{compact(askHigh)}</dd>
          </div>
        </dl>
        {scale}
        <span className="sb-strip-basis" title={detail || undefined}>
          {[currency, period, basis].filter(Boolean).join(', ')}
          {detail ? <Info aria-label={detail} /> : null}
        </span>
      </section>
    )
  }

  return (
    <section className="sb" aria-label={t('Compensation band')}>
      <header>
        <h4>{t('Compensation band')}</h4>
        <span className={`sb-confidence ${compensation.confidence ?? 'unknown'}`}>
          {t(compensation.confidence === 'researched' ? 'researched' : 'comparable')}
        </span>
      </header>

      {scale}

      <dl className="sb-figures">
        <div>
          <dt>{t('Floor')}</dt>
          <dd>{compact(floor)}</dd>
        </div>
        <div>
          <dt>{t('Central')}</dt>
          <dd>
            {compact(centralLow)}&ndash;{compact(centralHigh)}
          </dd>
        </div>
        <div className="emphasis">
          <dt>{t('Ask')}</dt>
          <dd>
            {compact(askLow)}&ndash;{compact(askHigh)}
          </dd>
        </div>
      </dl>

      <p className="sb-basis">
        {[currency, period, basis].filter(Boolean).join(', ')}
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
