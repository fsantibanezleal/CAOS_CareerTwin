import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

type Locale = 'en' | 'es'
type MessageKey = keyof typeof messages.en

const messages = {
  en: {
    today: 'Today',
    profile: 'Profile',
    opportunities: 'Opportunities',
    matches: 'Matches',
    pipeline: 'Pipeline',
    admin: 'Account administration',
    architecture: 'System architecture',
    chat: 'Career copilot',
    signOut: 'Sign out',
    evidenceFirst: 'Evidence-first career intelligence',
    unknownNotWeakness: 'Unknown is not a weakness. Add evidence before drawing conclusions.',
    alignmentNotProbability: 'Alignment score, not hiring probability',
    loading: 'Loading your workspace',
    error: 'Something needs attention',
    retry: 'Try again',
    empty: 'Nothing here yet',
    save: 'Save',
    cancel: 'Cancel',
    add: 'Add',
    review: 'Review',
    confirmed: 'Confirmed',
    proposed: 'Proposed',
    rejected: 'Rejected',
  },
  es: {
    today: 'Hoy',
    profile: 'Perfil',
    opportunities: 'Oportunidades',
    matches: 'Coincidencias',
    pipeline: 'Proceso',
    admin: 'Administrar cuentas',
    architecture: 'Arquitectura del sistema',
    chat: 'Copiloto profesional',
    signOut: 'Cerrar sesión',
    evidenceFirst: 'Inteligencia profesional basada en evidencia',
    unknownNotWeakness: 'Desconocido no es una debilidad. Agrega evidencia antes de concluir.',
    alignmentNotProbability: 'Puntaje de alineación, no probabilidad de contratación',
    loading: 'Cargando tu espacio',
    error: 'Algo requiere atención',
    retry: 'Reintentar',
    empty: 'Aún no hay contenido',
    save: 'Guardar',
    cancel: 'Cancelar',
    add: 'Agregar',
    review: 'Revisar',
    confirmed: 'Confirmado',
    proposed: 'Propuesto',
    rejected: 'Rechazado',
  },
} as const

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string }
const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children, initial = 'en' }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial)
  const value = useMemo(
    () => ({ locale, setLocale, t: (key: MessageKey) => messages[locale][key] }),
    [locale],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n requires I18nProvider')
  return context
}
