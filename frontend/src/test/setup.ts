import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom has no layout/scroll implementation; rendered geometry is checked separately.
HTMLElement.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.cookie = 'ct_csrf=; Max-Age=0; Path=/'
})
