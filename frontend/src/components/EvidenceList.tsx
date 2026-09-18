import { useI18n } from '../i18n'
import { useClaims } from '../useClaims'

/**
 * What answers a requirement, in words.
 *
 * Requirement details showed "Evidence 0" beside "Met" (issue #189): a count, and a zero whenever
 * the answer was a profile record, such as a degree or a role, rather than a confirmed claim.
 * This lists the confirmed claims behind the assessment as their statements, and says so when a
 * named profile record answered it instead.
 */
export function EvidenceList({ ids, status }: { ids: string[]; status?: string }) {
  const { t } = useI18n()
  const claims = useClaims(ids.length > 0)
  if (ids.length) {
    const byId = new Map((claims.data ?? []).map((claim) => [claim.id, claim]))
    return (
      <div className="ev-list">
        <h5>{t('Backed by')}</h5>
        <ul>
          {ids.map((id) => (
            <li key={id}>{byId.get(id)?.statement ?? (claims.isPending ? '…' : t('A confirmed claim no longer in the profile'))}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (status === 'met' || status === 'partial') return <p className="ev-note">{t('Answered by the profile record named above, not by a confirmed claim.')}</p>
  return null
}
