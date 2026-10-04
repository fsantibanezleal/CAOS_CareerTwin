import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../i18n'

/** Catch rejected lazy imports or route render failures without losing the shared shell. */
export class WorkspaceViewBoundary extends Component<{
  children: ReactNode
  reload?: () => void
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <RecoveryView reload={this.props.reload ?? (() => window.location.reload())} />
    return this.props.children
  }
}

/** User-controlled recovery only: no automatic reload loop or raw exception disclosure. */
function RecoveryView({ reload }: { reload: () => void }) {
  const { t } = useI18n()
  return <section className="state-message error" role="alert">
    <AlertTriangle aria-hidden="true" />
    <div>
      <h2>{t('This workspace view could not load')}</h2>
      <p>{t('A new release or a network problem may have interrupted this view. Reload to reconnect.')}</p>
      <p>{t('Saved records are preserved. Unsaved edits may be lost when you reload.')}</p>
      <button className="button secondary" onClick={reload}>{t('Reload workspace')}</button>
    </div>
  </section>
}
