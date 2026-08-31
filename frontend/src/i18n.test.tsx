import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from './i18n'

function LocaleProbe() {
  const { locale } = useI18n()
  return <span>{locale}</span>
}

describe('I18nProvider account hydration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = 'en'
  })

  it('replaces an anonymous locale with the authenticated account locale', async () => {
    window.localStorage.setItem('ct-locale', 'es')
    const view = render(<I18nProvider key="anonymous"><LocaleProbe /></I18nProvider>)

    expect(screen.getByText('es')).toBeInTheDocument()
    view.rerender(<I18nProvider key="account-user-1" initial="en"><LocaleProbe /></I18nProvider>)

    await waitFor(() => expect(screen.getByText('en')).toBeInTheDocument())
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('ct-locale')).toBe('en')
  })
})
