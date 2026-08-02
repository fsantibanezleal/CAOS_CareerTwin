import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  document.cookie = 'ct_csrf=; Max-Age=0; Path=/'
})
