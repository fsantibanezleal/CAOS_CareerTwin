import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import axe from 'axe-core'
import { expect, it } from 'vitest'
import { Login } from './components/Login'
import { I18nProvider } from './i18n'

it('has no automatically detectable serious or critical login violations', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <QueryClientProvider client={client}>
      <I18nProvider initial="en"><Login onSuccess={() => undefined} /></I18nProvider>
    </QueryClientProvider>,
  )
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  const blocking = result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])
})
