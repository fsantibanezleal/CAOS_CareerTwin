import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

/** A modal sheet for secondary tools and editors, so they never occupy the working surface. */
export function Dialog({ label, onClose, children, wide = false }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`dialog-sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label={t('Close')}>
          <X />
        </button>
        {children}
      </section>
    </div>
  )
}
