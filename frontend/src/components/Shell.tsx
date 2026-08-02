import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  const logout = useMutation({ mutationFn: () => api('/api/auth/logout', { method: 'POST' }), onSuccess: onLogout })
  const preferences = useMutation({
    mutationFn: ({ nextLocale, nextTheme }: { nextLocale: 'en' | 'es'; nextTheme: 'dark' | 'light' }) => api<User>('/api/auth/preferences', { method: 'PATCH', body: JSON.stringify({ locale: nextLocale, theme: nextTheme }) }),
    onSuccess: (updated) => client.setQueryData(['session'], updated),
  })
  const switchLocale = () => {
    const nextLocale = locale === 'en' ? 'es' : 'en'
    setLocale(nextLocale)
    preferences.mutate({ nextLocale, nextTheme: theme })
  }
  const switchTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    preferences.mutate({ nextLocale: locale, nextTheme })
  }
  const nav = [
    ['/', t('today'), LayoutDashboard], ['/profile', t('profile'), CircleUserRound],
    ['/opportunities', t('opportunities'), BriefcaseBusiness], ['/matches', t('matches'), Target],
    ['/pipeline', t('pipeline'), CalendarRange],
  ] as const
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-lockup compact" onClick={() => navigate('/')}><span className="brand-mark"><Orbit /></span><span>CareerTwin<small>Career intelligence</small></span></button>
        <nav aria-label="Primary navigation">{nav.map(([path, label, Icon]) => <NavLink key={path} to={path} end={path === '/'}><Icon /><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-trust"><Shield /><div><b>Private by design</b><small>Agents propose. You decide.</small></div></div>
        <button className="architecture-trigger" onClick={() => setArchitecture(true)}><Network /><span><b>{t('architecture')}</b><small>Inspect all six views</small></span></button>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <button className="command-search" onClick={() => setChat(true)}><Search /><span>Search or ask CareerTwin</span><kbd>Ctrl K</kbd></button>
          <div className="topbar-actions">
            <button className="icon-button" onClick={switchLocale} aria-label="Switch language"><Languages /><small>{locale.toUpperCase()}</small></button>
            <button className="icon-button" onClick={switchTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun /> : <Moon />}</button>
            <button className="chat-button" onClick={() => setChat(true)}><MessageCircleMore /><span>{t('chat')}</span></button>
            <div className="account-menu"><button onClick={() => setAccount(!account)}><span className="avatar">{user.display_name.slice(0, 2).toUpperCase()}</span><span><b>{user.display_name}</b><small>{user.is_superuser ? 'Superuser + seeker' : 'Seeker workspace'}</small></span><ChevronDown /></button>{account && <div className="account-popover">{user.is_superuser && <NavLink to="/admin" onClick={() => setAccount(false)}><UserRoundCog /> {t('admin')}</NavLink>}<button onClick={() => { setAccount(false); setSecurity(true) }}><KeyRound /> Account security</button><button onClick={() => logout.mutate()}><LogOut /> {t('signOut')}</button></div>}</div>
          </div>
        </header>
        <main id="main-content" className="content">{user.must_change_password && <div className="security-banner">Your account uses a temporary password. <button className="text-button" onClick={() => setSecurity(true)}>Change it before adding private documents.</button></div>}{children}</main>
      </div>
      <ArchitectureModal open={architecture} onClose={() => setArchitecture(false)} />
      <ChatDrawer open={chat} onClose={() => setChat(false)} />
      <AccountSecurityModal open={security} onClose={() => setSecurity(false)} onPasswordChanged={onLogout} />
    </div>
  )
}
