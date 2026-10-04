import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { WorkspaceViewBoundary } from './WorkspaceViewBoundary'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function FailedRoute(): never {
  throw new Error('private-error-content-must-not-be-displayed')
}

it('preserves normal route content', () => {
  render(<I18nProvider initial="en"><WorkspaceViewBoundary><p>Healthy route</p></WorkspaceViewBoundary></I18nProvider>)
  expect(screen.getByText('Healthy route')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each([
  ['en', 'This workspace view could not load', 'Reload workspace'],
  ['es', 'No se pudo cargar esta vista', 'Recargar el espacio de trabajo'],
] as const)('shows private, explicit recovery in %s without reloading automatically', (locale, title, action) => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  render(<I18nProvider initial={locale}><WorkspaceViewBoundary reload={reload}><FailedRoute /></WorkspaceViewBoundary></I18nProvider>)
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  expect(screen.queryByText('private-error-content-must-not-be-displayed')).not.toBeInTheDocument()
  expect(reload).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: action }))
  expect(reload).toHaveBeenCalledOnce()
})
