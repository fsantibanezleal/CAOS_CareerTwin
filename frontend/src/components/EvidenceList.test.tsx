import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import type { Claim } from '../types'
import { EvidenceList } from './EvidenceList'

/**
 * A requirement's detail read "Evidence 0" beside "Met" (issue #189). It now quotes the confirmed
 * claims behind the assessment, and says when a named profile record answered it instead.
 */

const claim = (id: string, statement: string): Claim => ({
  id, claim_type: 'skill', statement, normalized_value: {}, source_locator: {}, confidence: 1, state: 'confirmed', created_at: '',
})

function renderWith(ids: string[], status: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  // The shared claims cache, as the profile page fills it; no request is made.
  client.setQueryData(['claims'], [claim('c1', 'SQL in 9 standalone files and embedded across 56 files.'), claim('c2', 'Data quality auditors in his own accelerator suite.')])
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider initial="en">
        <EvidenceList ids={ids} status={status} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('evidence behind a requirement', () => {
  afterEach(cleanup)

  it('quotes each confirmed claim behind the assessment', () => {
    renderWith(['c2', 'c1'], 'met')
    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['Data quality auditors in his own accelerator suite.', 'SQL in 9 standalone files and embedded across 56 files.'])
    expect(screen.getByText('Backed by')).toBeTruthy()
  })

  it('says a named profile record answered a met requirement that cites no claim', () => {
    renderWith([], 'met')
    expect(screen.getByText('Answered by the profile record named above, not by a confirmed claim.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows nothing for a requirement nothing answers', () => {
    const { container } = renderWith([], 'missing')
    expect(container.textContent).toBe('')
  })
})
