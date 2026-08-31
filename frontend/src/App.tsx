import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, type ReactNode, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { api } from './api'
import { Login } from './components/Login'
import { Loading } from './components/Primitives'
import { Shell } from './components/Shell'
import { I18nProvider, useI18n } from './i18n'
import type { User } from './types'

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))
const MatchesPage = lazy(() => import('./pages/MatchesPage').then((module) => ({ default: module.MatchesPage })))
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage').then((module) => ({ default: module.OpportunitiesPage })))
const PipelinePage = lazy(() => import('./pages/PipelinePage').then((module) => ({ default: module.PipelinePage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const TodayPage = lazy(() => import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })))

function AccessibleSurface({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return <><a className="skip-link" href="#main-content">{t('Skip to main content')}</a>{children}</>
}

export default function App() {
  const client = useQueryClient()
  const session = useQuery({ queryKey: ['session'], queryFn: () => api<User>('/api/auth/me'), retry: false })
  if (session.isPending) return <I18nProvider><AccessibleSurface><main id="main-content" className="boot-screen"><Loading label="Opening CareerTwin" /></main></AccessibleSurface></I18nProvider>
  if (session.error || !session.data) return <I18nProvider><AccessibleSurface><Login onSuccess={(user) => client.setQueryData(['session'], user)} /></AccessibleSurface></I18nProvider>
  const user = session.data
  return (
    <I18nProvider initial={user.locale}>
      <AccessibleSurface>
        <Shell user={user} onLogout={() => client.setQueryData(['session'], undefined)}>
          <Suspense fallback={<Loading label="Opening this workspace view" />}><Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/admin" element={user.is_superuser ? <AdminPage currentUserId={user.id} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes></Suspense>
        </Shell>
      </AccessibleSurface>
    </I18nProvider>
  )
}
