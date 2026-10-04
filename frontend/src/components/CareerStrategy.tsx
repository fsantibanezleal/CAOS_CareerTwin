import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import { ErrorState, Loading, Panel } from './Primitives'

export type Strategy = {
  current_role: string; target_titles: string[]; location: string; modalities: string[];
  currency: string; basis: 'gross' | 'net' | 'unspecified'; period: 'month' | 'year';
  current_fixed: number | null; minimum_move: number | null; desired_uplift_percent: number; transition_cost: number;
  positioning: string; evidence_priorities: string[]; market_references: Array<{ label: string; source_url: string; checked_on: string; currency: string; basis: string; period: string; low: number | null; high: number | null; note: string }>;
}
type Offer = { currency: string; basis: Strategy['basis']; period: Strategy['period'] | 'unspecified'; low: number | null; high: number | null; kind: 'employer' | 'benchmark' }
export type Comparison = { threshold: number | null; currency: string; basis: string; period: string; status: string; notes: string[]; uplift_low_percent: number | null; uplift_high_percent: number | null; offer_low: number | null; offer_high: number | null }
export type StrategyResponse = { strategy: Strategy; revision: number; comparison: Comparison }
const comparisonLabels: Record<string, string> = {
  not_compared: 'Not compared', missing_inputs: 'Missing comparison inputs',
  incompatible: 'Incompatible compensation units', benchmark_only: 'Market benchmark only',
  meets_threshold: 'Meets fixed-pay threshold', below_threshold: 'Below fixed-pay threshold',
  overlaps_threshold: 'Offer range overlaps threshold',
}

/** Private aspirations and pay scenarios, separate from confirmed professional evidence and match scores. */
export function CareerStrategy() {
  const { t } = useI18n()
  const query = useQuery({ queryKey: ['career-strategy'], queryFn: () => api<StrategyResponse>('/api/job-search/strategy'), retry: false })
  if (query.isPending) return <Loading label={t('Loading career strategy')} />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  return <StrategyEditor key={query.data.revision} value={query.data} reload={() => query.refetch()} />
}

function StrategyEditor({ value, reload }: { value: StrategyResponse; reload: () => void }) {
  const { t, locale } = useI18n()
  const client = useQueryClient()
  const [draft, setDraft] = useState(value.strategy)
  const [targetText, setTargetText] = useState(value.strategy.target_titles.join('\n'))
  const [priorityText, setPriorityText] = useState(value.strategy.evidence_priorities.join('\n'))
  const [offer, setOffer] = useState<Offer>({ currency: value.strategy.currency, basis: 'unspecified', period: 'unspecified', low: null, high: null, kind: 'employer' })
  const save = useMutation({
    mutationFn: () => api<StrategyResponse>('/api/job-search/strategy', json('PUT', { strategy: draft, revision: value.revision })),
    onSuccess: (result) => { client.setQueryData(['career-strategy'], result); client.invalidateQueries({ queryKey: ['profile'] }) },
  })
  const compare = useMutation({ mutationFn: () => api<Comparison>('/api/job-search/strategy/compare', json('POST', { strategy: draft, offer })) })
  const field = <K extends keyof Strategy>(key: K, input: Strategy[K]) => { setDraft((old) => ({ ...old, [key]: input })); compare.reset() }
  const offerField = <K extends keyof Offer>(key: K, input: Offer[K]) => { setOffer((old) => ({ ...old, [key]: input })); compare.reset() }
  const referenceField = (index: number, key: keyof Strategy['market_references'][number], input: string | number | null) => field('market_references', draft.market_references.map((reference, item) => item === index ? { ...reference, [key]: input } : reference))
  const number = (raw: string) => raw === '' ? null : Number(raw)
  const lines = (raw: string) => raw.split('\n').map((line) => line.trim()).filter(Boolean)
  const computedThreshold = Math.max(draft.minimum_move ?? 0, draft.current_fixed === null ? 0 : draft.current_fixed * (1 + draft.desired_uplift_percent / 100) + draft.transition_cost) || null
  const format = (amount: number | null) => amount === null ? t('Unknown') : new Intl.NumberFormat(locale === 'es' ? 'es-CL' : 'en-US', { maximumFractionDigits: 2 }).format(amount)
  const result = compare.data
  const maximum = result ? Math.max(result.threshold ?? 0, result.offer_low ?? 0, result.offer_high ?? 0) * 1.15 : 0
  return <div className="career-strategy"><Panel title={t('Career strategy')} subtitle={t('Define the move you want, not qualifications or authority you have not demonstrated. These preferences stay private.')}>
    <form onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <fieldset disabled={save.isPending} className="strategy-fields"><legend className="sr-only">{t('Private career targets')}</legend>
        <div className="form-grid two"><label>{t('Current role')}<input maxLength={240} value={draft.current_role} onChange={(event) => field('current_role', event.target.value)} /></label><label>{t('Preferred location')}<input maxLength={160} value={draft.location} onChange={(event) => field('location', event.target.value)} /></label></div>
        <label>{t('Target roles, one per line')}<textarea aria-label={t('Target roles, one per line')} rows={4} value={targetText} onChange={(event) => { setTargetText(event.target.value); field('target_titles', lines(event.target.value)) }} /><small>{t('Targets are aspirations, not titles added to your experience.')}</small></label>
        <div className="battery-sources">{['remote', 'hybrid', 'onsite'].map((mode) => <label key={mode}><input type="checkbox" checked={draft.modalities.includes(mode)} onChange={(event) => field('modalities', event.target.checked ? [...draft.modalities, mode] : draft.modalities.filter((item) => item !== mode))} />{t(mode)}</label>)}</div>
        <label>{t('Leadership positioning')}<textarea rows={4} maxLength={8000} value={draft.positioning} onChange={(event) => field('positioning', event.target.value)} /><small>{t('Describe demonstrated area, programme and team responsibility. Do not substitute repository counts for leadership or invent budget authority.')}</small></label>
        <label>{t('Evidence priorities, one per line')}<textarea rows={3} value={priorityText} onChange={(event) => { setPriorityText(event.target.value); field('evidence_priorities', lines(event.target.value)) }} /></label>
        <details className="strategy-pay" open><summary>{t('Private compensation strategy')}</summary><p>{t('Use fixed compensation with an explicit currency, gross/net basis and period. Bonuses, benefits and transition risk require a separate comparison.')}</p>
          <div className="form-grid three"><label>{t('Currency')}<input required pattern="[A-Z]{3}" maxLength={3} value={draft.currency} onChange={(event) => field('currency', event.target.value.toUpperCase())} /></label><label>{t('Compensation basis')}<select aria-label={t('Compensation basis')} value={draft.basis} onChange={(event) => field('basis', event.target.value as Strategy['basis'])}>{['unspecified', 'gross', 'net'].map((basis) => <option key={basis} value={basis}>{t(basis)}</option>)}</select></label><label>{t('Pay period')}<select aria-label={t('Pay period')} value={draft.period} onChange={(event) => field('period', event.target.value as Strategy['period'])}><option value="month">{t('month')}</option><option value="year">{t('year')}</option></select></label></div>
          <div className="form-grid two"><label>{t('Current fixed pay')}<input type="number" min="0.01" max="1000000000000" step="any" value={draft.current_fixed ?? ''} onChange={(event) => field('current_fixed', number(event.target.value))} /></label><label>{t('Explicit minimum for a move')}<input type="number" min="0.01" max="1000000000000" step="any" value={draft.minimum_move ?? ''} onChange={(event) => field('minimum_move', number(event.target.value))} /></label><label>{t('Desired increase percent')}<input type="number" min="0" max="200" step="any" value={draft.desired_uplift_percent} onChange={(event) => field('desired_uplift_percent', Number(event.target.value))} /></label><label>{t('Recurring transition cost in the same pay period')}<input type="number" min="0" max="1000000000000" step="any" value={draft.transition_cost} onChange={(event) => field('transition_cost', Number(event.target.value))} /></label></div>
          <output className="strategy-threshold"><Target /><span>{t('Your scenario threshold')}: <b>{draft.currency} {format(computedThreshold)} / {t(draft.period)}</b> · {t(draft.basis)}</span></output><small>{t('Maximum of your explicit floor and current fixed pay plus desired increase plus recurring transition cost. This is your scenario, not an employer budget or a market prediction.')}</small>
        </details>
        <details className="strategy-pay"><summary>{t('Attributed salary research')}</summary><p>{t('Optional dated references are research only. They never become actual employer compensation or an approved move.')}</p>
          {draft.market_references.map((reference, index) => <fieldset key={index} className="strategy-reference"><legend>{t('Research reference')} {index + 1}</legend>
            <div className="form-grid two">
              <label>{t('Reference label')}<input required maxLength={200} value={reference.label} onChange={(event) => referenceField(index, 'label', event.target.value)} /></label>
              <label>{t('Public source URL')}<input required type="url" value={reference.source_url} onChange={(event) => referenceField(index, 'source_url', event.target.value)} /></label>
              <label>{t('Date checked')}<input required type="date" value={reference.checked_on} onChange={(event) => referenceField(index, 'checked_on', event.target.value)} /></label>
              <label>{t('Reference currency')}<input required pattern="[A-Z]{3}" maxLength={3} value={reference.currency} onChange={(event) => referenceField(index, 'currency', event.target.value.toUpperCase())} /></label>
              <label>{t('Reference basis')}<select aria-label={t('Reference basis')} value={reference.basis} onChange={(event) => referenceField(index, 'basis', event.target.value)}>{['unspecified', 'gross', 'net'].map((basis) => <option key={basis}>{t(basis)}</option>)}</select></label>
              <label>{t('Reference period')}<select aria-label={t('Reference period')} value={reference.period} onChange={(event) => referenceField(index, 'period', event.target.value)}>{['unspecified', 'month', 'year'].map((period) => <option key={period}>{t(period)}</option>)}</select></label>
              <label>{t('Reference minimum')}<input type="number" min="0" max="1000000000000" step="any" value={reference.low ?? ''} onChange={(event) => referenceField(index, 'low', number(event.target.value))} /></label>
              <label>{t('Reference maximum')}<input type="number" min="0" max="1000000000000" step="any" value={reference.high ?? ''} onChange={(event) => referenceField(index, 'high', number(event.target.value))} /></label>
            </div><label>{t('Research notes')}<textarea rows={2} maxLength={3000} value={reference.note} onChange={(event) => referenceField(index, 'note', event.target.value)} /></label>
            <button className="button ghost" type="button" onClick={() => field('market_references', draft.market_references.filter((_, item) => item !== index))}><Trash2 />{t('Remove reference')}</button>
          </fieldset>)}
          <button className="button secondary" type="button" disabled={draft.market_references.length >= 20} onClick={() => field('market_references', [...draft.market_references, { label: '', source_url: '', checked_on: '', currency: draft.currency, basis: 'unspecified', period: 'unspecified', low: null, high: null, note: '' }])}><Plus />{t('Add research reference')}</button>
        </details>
        <button className="button primary" type="submit"><Save />{t('Save career strategy')}</button>
      </fieldset>
      {save.error && <ErrorState error={save.error} retry={reload} />}
    </form>
  </Panel><Panel title={t('Evaluate a salary scenario')} subtitle={t('Compare declared employer compensation or a clearly labelled benchmark. Financial alignment alone does not establish career advancement.')}>
    <form onSubmit={(event) => { event.preventDefault(); compare.mutate() }}><div className="form-grid three"><label>{t('Salary evidence type')}<select aria-label={t('Salary evidence type')} value={offer.kind} onChange={(event) => offerField('kind', event.target.value as Offer['kind'])}><option value="employer">{t('Declared employer compensation')}</option><option value="benchmark">{t('Market benchmark only')}</option></select></label><label>{t('Offer currency')}<input required pattern="[A-Z]{3}" maxLength={3} value={offer.currency} onChange={(event) => offerField('currency', event.target.value.toUpperCase())} /></label><label>{t('Offer basis')}<select aria-label={t('Offer basis')} value={offer.basis} onChange={(event) => offerField('basis', event.target.value as Offer['basis'])}>{['unspecified', 'gross', 'net'].map((basis) => <option key={basis} value={basis}>{t(basis)}</option>)}</select></label><label>{t('Offer period')}<select aria-label={t('Offer period')} value={offer.period} onChange={(event) => offerField('period', event.target.value as Offer['period'])}>{['unspecified', 'month', 'year'].map((period) => <option key={period} value={period}>{t(period)}</option>)}</select></label><label>{t('Offer fixed minimum')}<input type="number" min="0" max="1000000000000" step="any" value={offer.low ?? ''} onChange={(event) => offerField('low', number(event.target.value))} /></label><label>{t('Offer fixed maximum')}<input type="number" min="0" max="1000000000000" step="any" value={offer.high ?? ''} onChange={(event) => offerField('high', number(event.target.value))} /></label></div><button type="submit" className="button secondary" disabled={compare.isPending}>{t('Compare fixed pay')}</button></form>
    {compare.error && <ErrorState error={compare.error} />}{result && <div className="strategy-result" role="status"><h3>{t(comparisonLabels[result.status] ?? 'Unknown')}</h3><p>{t('Your scenario threshold')}: {result.currency} {format(result.threshold)} / {t(result.period)} · {t(result.basis)}</p>{maximum > 0 && result.offer_low !== null && <svg viewBox="0 0 600 80" role="img" aria-label={t('Fixed pay and threshold comparison')}><rect x="10" y="25" width="560" height="20" rx="6" fill="var(--surface-2)" /><rect x="10" y="25" width={560 * result.offer_low / maximum} height="20" rx="6" fill="var(--cyan)" /><line x1={10 + 560 * (result.threshold ?? 0) / maximum} x2={10 + 560 * (result.threshold ?? 0) / maximum} y1="10" y2="62" stroke="var(--text)" strokeWidth="2" /></svg>}<p>{t('Comparable offer range')}: {format(result.offer_low)} – {format(result.offer_high)} · {t('Increase from current pay')}: {result.uplift_low_percent === null ? t('Unknown') : `${format(result.uplift_low_percent)}%`} – {result.uplift_high_percent === null ? t('Unknown') : `${format(result.uplift_high_percent)}%`}</p><ul>{result.notes.map((note) => <li key={note}>{t(note)}</li>)}</ul></div>}
  </Panel></div>
}
