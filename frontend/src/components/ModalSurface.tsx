import { useEffect, useRef, type ReactNode } from 'react'

const controls = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** A modal with Escape dismissal, contained keyboard focus and opener restoration.
 * Re-evaluate controls on each keypress so changing editor modes cannot strand focus.
 */
export function ModalSurface({ children, className, label, labelledBy, onClose }: { children: ReactNode; className: string; label?: string; labelledBy?: string; onClose: () => void }) {
  const surface = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = surface.current
    if (!dialog) return
    const candidates = () => [...dialog.querySelectorAll<HTMLElement>(controls)].filter((node) => !node.closest('[hidden], [inert]') && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden')
    const frame = requestAnimationFrame(() => (candidates()[0] ?? dialog).focus())
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = candidates()
      const first = items[0], last = items.at(-1)
      if (!first || !last) { event.preventDefault(); dialog.focus(); return }
      if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    const contain = (event: FocusEvent) => { if (event.target instanceof Node && !dialog.contains(event.target)) (candidates()[0] ?? dialog).focus() }
    document.addEventListener('keydown', keyboard, true)
    document.addEventListener('focusin', contain)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keyboard, true)
      document.removeEventListener('focusin', contain)
      if (opener?.isConnected) opener.focus()
    }
  }, [])
  return <section ref={surface} className={className} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} tabIndex={-1}>{children}</section>
}
