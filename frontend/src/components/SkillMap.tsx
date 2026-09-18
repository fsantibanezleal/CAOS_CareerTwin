import { Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Claim, Skill } from '../types'

/**
 * The skill map: every capability on the profile, how long it has been used, and whether a
 * confirmed claim backs it.
 *
 * It replaces two surfaces that drew the same 73 skills twice: a grid of equal-weight cards
 * led by a level pie, and a 73-row table of level and confidence bars. The level sits
 * between 90 and 98 for nearly every skill, so both led with the one dimension that barely
 * varies. The dimensions that differ, years of use and evidence, were grey text.
 *
 * Here years is the bar and evidence is the mark: filled when a confirmed claim backs the
 * skill, hollow when none does. With 41 of 73 skills unbacked, that gap is the most useful
 * thing on the page, so it has its own filter.
 */

const MAX_YEARS_FLOOR = 10

export function SkillMap({
  skills,
  claims,
  onAdd,
  onRemove,
}: {
  skills: Skill[]
  claims: Claim[]
  onAdd?: () => void
  onRemove?: (skill: Skill) => void
}) {
  const { t, plural } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [unbackedOnly, setUnbackedOnly] = useState(false)
  const [selected, setSelected] = useState<string>()

  const claimById = useMemo(() => new Map(claims.map((claim) => [claim.id, claim])), [claims])
  const maxYears = useMemo(() => Math.max(MAX_YEARS_FLOOR, ...skills.map((skill) => skill.years)), [skills])
  const unbacked = useMemo(() => skills.filter((skill) => skill.evidence_count === 0).length, [skills])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const skill of skills) counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [skills])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const visible = skills.filter(
      (skill) =>
        (category === 'all' || skill.category === category) &&
        (!unbackedOnly || skill.evidence_count === 0) &&
        (!needle || skill.name.toLowerCase().includes(needle)),
    )
    const byCategory = new Map<string, Skill[]>()
    for (const skill of visible) byCategory.set(skill.category, [...(byCategory.get(skill.category) ?? []), skill])
    // Largest groups first; within a group, the longest-used skill first.
    return [...byCategory.entries()]
      .map(([name, items]) => ({ name, items: items.sort((a, b) => b.years - a.years || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
  }, [skills, query, category, unbackedOnly])

  const detail = skills.find((skill) => skill.id === selected)
  // Absent from a server older than this component; treat as none rather than crash.
  const detailEvidence = detail?.evidence_ids ?? []

  return (
    <section className="sm" aria-label={t('Skill map')}>
      <div className="sm-controls">
        <label className="sm-search">
          <Search aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search skills')} aria-label={t('Search skills')} />
        </label>
        <select className="sm-category" value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t('Category')}>
          <option value="all">{t('All categories')} ({skills.length})</option>
          {categories.map(([name, count]) => (
            <option key={name} value={name}>
              {t(name)} ({count})
            </option>
          ))}
        </select>
        <label className="sm-toggle" title={t('Skills no confirmed claim backs yet')}>
          <input type="checkbox" checked={unbackedOnly} onChange={(event) => setUnbackedOnly(event.target.checked)} />
          {t('Without evidence')} <span>{unbacked}</span>
        </label>
        <span className="sm-legend" aria-hidden>
          <i className="sm-mark backed" /> {t('backed')}
          <i className="sm-mark" /> {t('not backed')}
        </span>
        {onAdd ? (
          <button type="button" className="ob-action" onClick={onAdd}>
            <Plus aria-hidden /> {t('Add skill')}
          </button>
        ) : null}
      </div>

      <div className="sm-columns">
        <div className="sm-flow">
        {groups.map((group) => (
          <div key={group.name} className="sm-group">
            <h3>
              {t(group.name)} <span>{group.items.length}</span>
            </h3>
            <ul>
              {group.items.map((skill) => (
                <li key={skill.id}>
                  <button
                    type="button"
                    className={`sm-row ${selected === skill.id ? 'selected' : ''}`}
                    aria-pressed={selected === skill.id}
                    onClick={() => setSelected(selected === skill.id ? undefined : skill.id)}
                    title={`${skill.name} · ${plural(skill.years, '{count} year', '{count} years')} · ${plural(skill.evidence_count, '{count} backing claim', '{count} backing claims')}`}
                  >
                    <i className={`sm-mark ${skill.evidence_count > 0 ? 'backed' : ''}`} aria-hidden />
                    <span className="sm-name">{skill.name}</span>
                    <span className="sm-bar" aria-hidden>
                      <i style={{ width: `${Math.round((skill.years / maxYears) * 100)}%` }} />
                    </span>
                    <span className="sm-years">{skill.years}y</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </div>
        {groups.length === 0 ? <p className="sm-empty">{t('No skill matches these filters.')}</p> : null}
      </div>

      {detail ? (
        <aside className="sm-detail" aria-label={detail.name}>
          <header>
            <span className="sm-detail-category">{t(detail.category)}</span>
            <button type="button" className="icon-button" onClick={() => setSelected(undefined)} aria-label={t('Close')}>
              <X />
            </button>
          </header>
          <h4>{detail.name}</h4>
          <dl>
            <div><dt>{t('Years')}</dt><dd>{detail.years}</dd></div>
            <div><dt>{t('Level')}</dt><dd>{Math.round(detail.level * 100)}%</dd></div>
            <div><dt>{t('Confidence')}</dt><dd>{Math.round(detail.confidence * 100)}%</dd></div>
          </dl>
          <p className="sm-detail-evidence">
            {detailEvidence.length
              ? plural(detailEvidence.length, 'Backed by {count} confirmed claim', 'Backed by {count} confirmed claims')
              : t('No confirmed claim backs this skill yet.')}
          </p>
          {detailEvidence.length ? (
            <ul className="sm-claims">
              {detailEvidence.map((id) => (
                <li key={id}>{claimById.get(id)?.statement ?? id}</li>
              ))}
            </ul>
          ) : null}
          {onRemove ? (
            <button type="button" className="button ghost danger" onClick={() => { onRemove(detail); setSelected(undefined) }}>
              <Trash2 /> {t('Remove skill')}
            </button>
          ) : null}
        </aside>
      ) : null}
    </section>
  )
}
