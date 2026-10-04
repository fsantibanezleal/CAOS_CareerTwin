import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ArchitectureModal } from './ArchitectureModal'

afterEach(cleanup)

it('renders six shared architecture views and their public decision register', async () => {
  const close = vi.fn()
  const { container } = render(<I18nProvider initial="en"><ArchitectureModal open onClose={close} /></I18nProvider>)
  expect(screen.getByRole('dialog', {name:'CareerTwin architecture'})).toBeInTheDocument()
  const tabs = screen.getAllByRole('tab')
  expect(tabs).toHaveLength(6)
  for (const tab of tabs) {
    fireEvent.click(tab)
    expect(container.querySelector('svg[viewBox]')).toHaveAttribute('viewBox','0 0 1160 430')
    expect(container.querySelector('svg a')).toHaveAttribute('href','https://github.com/fsantibanezleal/CAOS_CareerTwin/tree/main/docs/adr')
    expect(container.querySelector('svg style')?.textContent).toContain('[data-arch-lang="en"] .l-es')
  }
  fireEvent.keyDown(window, {key:'Escape'})
  expect(close).toHaveBeenCalled()
})

it('uses the same Spanish locale for the shared modal and its graphics', () => {
  const { container } = render(<I18nProvider initial="es"><ArchitectureModal open onClose={() => {}} /></I18nProvider>)
  expect(screen.getByRole('dialog', {name:'Arquitectura de CareerTwin'})).toBeInTheDocument()
  expect(container.querySelector('[data-arch-lang]')).toHaveAttribute('data-arch-lang','es')
  expect(container.querySelector('svg style')?.textContent).toContain('[data-arch-lang="es"] .l-en')
})
