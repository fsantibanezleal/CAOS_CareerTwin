import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { Score } from './Primitives'

describe('alignment score semantics', () => {
  it('preserves insufficient evidence instead of rendering zero', () => {
    render(<I18nProvider initial="en"><Score /></I18nProvider>)
    expect(screen.getByText('Insufficient evidence')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('labels a known value as alignment', () => {
    render(<I18nProvider initial="en"><Score value={0.734} /></I18nProvider>)
    expect(screen.getByLabelText('73% alignment')).toBeInTheDocument()
  })
})
