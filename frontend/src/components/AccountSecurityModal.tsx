import { useMutation } from '@tanstack/react-query'
import { KeyRound, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import { ErrorState } from './Primitives'

export function AccountSecurityModal({ open, onClose, onPasswordChanged }: { open: boolean; onClose: () => void; onPasswordChanged: () => void }) {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const change = useMutation({
    mutationFn: () => api('/api/auth/change-password', json('POST', { current_password: currentPassword, new_password: newPassword })),
    onSuccess: onPasswordChanged,
  })
  if (!open) return null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmation) return
    change.mutate()
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-modal account-security-modal" role="dialog" aria-modal="true" aria-labelledby="account-security-title">
        <header><div><h2 id="account-security-title">{t('Account security')}</h2><p>{t('Changing your password revokes every active session, including this one.')}</p></div><button className="icon-button" onClick={onClose} aria-label={t('Close account security')}><X /></button></header>
        <form onSubmit={submit}>
          <label>{t('Current password')}<input type="password" autoComplete="current-password" required minLength={8} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>{t('New password')}<input type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>{t('Use at least 12 characters and do not reuse another account password.')}</small></label>
          <label>{t('Confirm new password')}<input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-invalid={Boolean(confirmation && newPassword !== confirmation)} />{confirmation && newPassword !== confirmation && <small className="field-error">{t('The passwords do not match.')}</small>}</label>
          {change.error && <ErrorState error={change.error} />}
          <footer><span>{t('Your password is stored only as an Argon2id hash.')}</span><button type="button" className="button ghost" onClick={onClose}>{t('Cancel')}</button><button className="button primary" disabled={change.isPending || newPassword !== confirmation}><KeyRound /> {t(change.isPending ? 'Changing…' : 'Change password')}</button></footer>
        </form>
      </section>
    </div>
  )
}
