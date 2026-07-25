import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { demoStore } from '@/lib/demoStore'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Profile, Subscription } from '@/types'

interface AuthContextValue {
  user: Profile | null
  subscription: Subscription | null
  loading: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  enterDemo: (asAdmin?: boolean) => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) return null
  return data as Profile
}

async function fetchSubscription(userId: string): Promise<Subscription | null> {
  if (!supabase) return null
  const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
  return (data as Subscription) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(!isSupabaseConfigured)

  const refreshProfile = useCallback(async () => {
    if (isDemo || !supabase) {
      const profile = demoStore.getProfile(user?.role === 'admin')
      setUser(profile)
      setSubscription(demoStore.getSubscription(profile.id) ?? null)
      return
    }
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      setUser(null)
      setSubscription(null)
      return
    }
    const [profile, sub] = await Promise.all([
      fetchProfile(data.user.id),
      fetchSubscription(data.user.id),
    ])
    setUser(profile)
    setSubscription(sub)
  }, [isDemo, user?.role])

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!isSupabaseConfigured || !supabase) {
        if (mounted) {
          setIsDemo(true)
          setLoading(false)
        }
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session?.user && mounted) {
        setIsDemo(false)
        const [profile, sub] = await Promise.all([
          fetchProfile(data.session.user.id),
          fetchSubscription(data.session.user.id),
        ])
        setUser(profile)
        setSubscription(sub)
      }
      if (mounted) setLoading(false)
    }

    void init()

    if (!supabase) return

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!session?.user) {
          setUser(null)
          setSubscription(null)
          return
        }
        setIsDemo(false)
        const [profile, subscriptionRow] = await Promise.all([
          fetchProfile(session.user.id),
          fetchSubscription(session.user.id),
        ])
        setUser(profile)
        setSubscription(subscriptionRow)
      })()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase não configurado. Use o modo demo.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Supabase não configurado. Use o modo demo.')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (isDemo || !supabase) {
      setUser(null)
      setSubscription(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
    setSubscription(null)
  }, [isDemo])

  const enterDemo = useCallback((asAdmin = false) => {
    setIsDemo(true)
    const profile = demoStore.getProfile(asAdmin)
    setUser(profile)
    setSubscription(demoStore.getSubscription(profile.id) ?? null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      subscription,
      loading,
      isDemo,
      signIn,
      signUp,
      signOut,
      enterDemo,
      refreshProfile,
    }),
    [user, subscription, loading, isDemo, signIn, signUp, signOut, enterDemo, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
