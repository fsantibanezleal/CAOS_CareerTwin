import { useMutation, useQueryClient } from '@tanstack/react-query'
import { WorkbenchShell } from '@fasl-work/caos-app-shell'
import { BriefcaseBusiness, CalendarRange, ChevronDown, CircleUserRound, KeyRound, Languages, LayoutDashboard, LogOut, MessageCircleMore, Moon, Network, Orbit, Search, Shield, Sun, Target, UserRoundCog } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { api } from '../api'
import { useI18n } from '../i18n'
import type { User } from '../types'
import { AccountSecurityModal } from './AccountSecurityModal'
import { ArchitectureModal } from './ArchitectureModal'
import { ChatDrawer } from './ChatDrawer'

export function Shell({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const { locale, setLocale, t } = useI18n()
  const [theme, setTheme] = useState<'dark' | 'light'>(user.theme)
  const [architecture, setArchitecture] = useState(false)
  const [chat, setChat] = useState(false)
  const [account, setAccount] = useState(false)
  const [security, setSecurity] = useState(user.must_change_password)
  const navigate = useNavigate()
  const client = useQueryClient()
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ct-theme', theme) }, [theme])
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setChat(true)
      }
      if (event.key === 'Escape') setAccount(false)
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [])
  const logout = useMutation({ mutationFn: () => api('/api/auth/logout', { method: 'POST' }), onSuccess: onLogout })
  const preferences = useMutation({
    mutationFn: ({ nextLocale, nextTheme }: { nextLocale: 'en' | 'es'; nextTheme: 'dark' | 'light' }) => api<User>('/api/auth/preferences', { method: 'PATCH', body: JSON.stringify({ locale: nextLocale, theme: nextTheme }) }),
    onSuccess: (updated) => client.setQueryData(['session'], updated),
  })
  const switchLocale = () => {
    const nextLocale = locale === 'en' ? 'es' : 'en'
    setLocale(nextLocale)
    preferences.mutate({ nextLocale, nextTheme: theme }, { onError: () => setLocale(locale) })
  }
  const switchTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    preferences.mutate({ nextLocale: locale, nextTheme })
  }
  const nav = [
    ['/', t('Today'), LayoutDashboard], ['/profile', t('Profile'), CircleUserRound],
    ['/opportunities', t('Opportunities'), BriefcaseBusiness], ['/matches', t('Matches'), Target],
    ['/pipeline', t('Pipeline'), CalendarRange],
  ] as const
  return (
    <WorkbenchShell
      brand={<button className="brand-lockup compact" onClick={() => navigate('/')}><span className="brand-mark"><Orbit /></span><span>CareerTwin<small>{t('Career intelligence')}</small></span></button>}
      routes={nav.map(([path, label, Icon]) => ({ path, label, icon: <Icon />, end: path === '/' }))}
      navigationLabel={t('Primary navigation')}
      sidebarFooter={<><div className="sidebar-trust"><Shield /><div><b>{t('Private by design')}</b><small>{t('Agents propose. You decide.')}</small></div></div><button className="architecture-trigger" onClick={() => setArchitecture(true)}><Network /><span><b>{t('System architecture')}</b><small>{t('Inspect all six views')}</small></span></button></>}
      headerLead={<button className="command-search" onClick={() => setChat(true)} aria-keyshortcuts="Control+K Meta+K"><Search /><span>{t('Search or ask CareerTwin')}</span><kbd>Ctrl K</kbd></button>}
      headerActions={
        <div className="topbar-actions">
            <button className="icon-button" onClick={switchLocale} aria-label={t(locale === 'en' ? 'Switch to Spanish' : 'Switch to English')} title={t(locale === 'en' ? 'Switch to Spanish' : 'Switch to English')}><Languages /><small>{locale.toUpperCase()}</small></button>
            <button className="icon-button" onClick={switchTheme} aria-label={t(theme === 'dark' ? 'Use light theme' : 'Use dark theme')} title={t(theme === 'dark' ? 'Use light theme' : 'Use dark theme')}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
            <button className="chat-button" onClick={() => setChat(true)}><MessageCircleMore /><span>{t('Career copilot')}</span></button>
            <div className="account-menu"><button onClick={() => setAccount(!account)} aria-expanded={account} aria-haspopup="menu" aria-label={t('Account menu')}><span className="avatar">{user.display_name.slice(0, 2).toUpperCase()}</span><span><b>{user.display_name}</b><small>{t(user.is_superuser ? 'Superuser + seeker' : 'Seeker workspace')}</small></span><ChevronDown /></button>{account && <div className="account-popover" role="menu">{user.is_superuser && <NavLink role="menuitem" to="/admin" onClick={() => setAccount(false)}><UserRoundCog /> {t('Account administration')}</NavLink>}<button role="menuitem" onClick={() => { setAccount(false); switchLocale() }}><Languages /> {t(locale === 'en' ? 'Switch to Spanish' : 'Switch to English')}</button><button role="menuitem" onClick={() => { setAccount(false); switchTheme() }}>{theme === 'dark' ? <Sun /> : <Moon />} {t(theme === 'dark' ? 'Use light theme' : 'Use dark theme')}</button><button role="menuitem" onClick={() => { setAccount(false); setSecurity(true) }}><KeyRound /> {t('Account security')}</button><button role="menuitem" onClick={() => logout.mutate()}><LogOut /> {t('Sign out')}</button></div>}</div>
        </div>
      }
      overlays={<><ArchitectureModal open={architecture} onClose={() => setArchitecture(false)} /><ChatDrawer open={chat} onClose={() => setChat(false)} /><AccountSecurityModal open={security} onClose={() => setSecurity(false)} onPasswordChanged={onLogout} /></>}
    >
      {user.must_change_password && <div className="security-banner">{t('Your account uses a temporary password.')} <button className="text-button" onClick={() => setSecurity(true)}>{t('Change it before adding private documents.')}</button></div>}{children}
    </WorkbenchShell>
  )
}
