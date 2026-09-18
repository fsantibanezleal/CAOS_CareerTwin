import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import type { Accomplishment, Claim } from '../types'

/**
 * STAR stories as a list and a reading pane.
 *
 * The accomplishment bank rendered every story fully expanded, situation, task, action and
 * result stacked for all seven, beneath a creation form: 3,392px on a 800px screen, where the
 * way to find one story was to scroll past the others. The list carries each story's title
 * and headline result; the pane shows the selected one whole, with its metrics and the claims
 * behind it. Creating a story is an action, not the first thing on the page.
 */

function metricText(metric: Record<string, unknown>): string {
  const label = String(metric.label ?? '')
  const value = metric.value
  const unit = metric.unit === 'percent' ? '%' : metric.unit ? ` ${String(metric.unit)}` : ''
  return label && value !== undefined ? `${String(value)}${unit} ${label}` : label
}

export function StarStories({
  stories,
  claims,
  onCreate,
  onRemove,
}: {
  stories: Accomplishment[]
  claims: Claim[]
  onCreate?: () => void
  onRemove?: (story: Accomplishment) => void
}) {
  const { t, plural } = useI18n()
  const [selectedId, setSelectedId] = useState<string>()
  const selected = stories.find((story) => story.id === selectedId) ?? stories[0]
  const claimById = new Map(claims.map((claim) => [claim.id, claim]))

  return (
    <section className="ss" aria-label={t('STAR stories')}>
      <nav className="ss-list" aria-label={t('Stories')}>
        <header>
          <span>
            {t('Stories')} <b>{stories.length}</b>
          </span>
          {onCreate ? (
            <button type="button" className="ob-action" onClick={onCreate}>
              <Plus aria-hidden /> {t('New story')}
            </button>
          ) : null}
        </header>
        <ul>
          {stories.map((story) => (
            <li key={story.id}>
              <button
                type="button"
                className={`ss-item ${selected?.id === story.id ? 'selected' : ''}`}
                aria-current={selected?.id === story.id}
                onClick={() => setSelectedId(story.id)}
              >
                <b>{story.title}</b>
                <small>
                  <i className={`ss-status ${story.status}`} aria-hidden /> <span className="ss-status-label">{t(story.status)}</span>
                  {story.evidence_ids.length ? ` · ${plural(story.evidence_ids.length, '{count} evidence link', '{count} evidence links')}` : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
        {stories.length === 0 ? <p className="ss-empty">{t('No accomplishment stories yet')}</p> : null}
      </nav>

      {selected ? (
        <article className="ss-pane">
          <header>
            <h3>{selected.title}</h3>
            {onRemove ? (
              <button type="button" className="icon-button" onClick={() => onRemove(selected)} aria-label={t('Delete')}>
                <Trash2 />
              </button>
            ) : null}
          </header>
          {selected.metrics.length ? (
            <ul className="ss-metrics">
              {selected.metrics.map((metric, index) => (
                <li key={index}>{metricText(metric)}</li>
              ))}
            </ul>
          ) : null}
          <dl className="ss-star">
            <div><dt>{t('Situation')}</dt><dd>{selected.situation || t('Not recorded')}</dd></div>
            <div><dt>{t('Task')}</dt><dd>{selected.task || t('Not recorded')}</dd></div>
            <div><dt>{t('Action')}</dt><dd>{selected.action || t('Not recorded')}</dd></div>
            <div className="result"><dt>{t('Result')}</dt><dd>{selected.result || t('Not recorded')}</dd></div>
          </dl>
          {selected.skills.length ? (
            <p className="ss-skills">
              {selected.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </p>
          ) : null}
          {selected.evidence_ids.length ? (
            <div className="ss-evidence">
              <h4>{t('Backed by')}</h4>
              <ul>
                {selected.evidence_ids.map((id) => (
                  <li key={id}>{claimById.get(id)?.statement ?? id}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  )
}
