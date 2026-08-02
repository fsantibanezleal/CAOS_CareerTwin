import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Score } from './Primitives'

describe('alignment score semantics', () => {
  it('preserves insufficient evidence instead of rendering zero', () => {
    render(<Score />)
    expect(screen.getByText('Insufficient evidence')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('labels a known value as alignment', () => {
    render(<Score value={0.734} />)
    expect(screen.getByLabelText('73% alignment')).toBeInTheDocument()
  })
})
