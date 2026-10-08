import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalSurface } from './ModalSurface'

describe('modal interaction contract', () => {
  it('receives focus, traps both directions, dismisses on Escape and restores the opener', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const close = vi.fn()
    const view = render(<ModalSurface className="test-modal" label="Edit data" onClose={close}><button>Close</button><input aria-label="Name" /><button>Save</button></ModalSurface>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus())
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
    view.unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
  it('includes newly rendered editor controls and excludes disabled controls', async () => {
    const close = vi.fn()
    const view = render(<ModalSurface className="test-modal" label="Modes" onClose={close}><button>Close</button><button disabled>Disabled</button></ModalSurface>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus())
    view.rerender(<ModalSurface className="test-modal" label="Modes" onClose={close}><button>Close</button><input aria-label="New mode field" /><button disabled>Disabled</button></ModalSurface>)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('textbox', { name: 'New mode field' })).toHaveFocus()
  })
})
