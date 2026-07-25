import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'light' : getStoredTheme(),
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (next: Theme) => setThemeState(next)
  const toggleTheme = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'))

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
