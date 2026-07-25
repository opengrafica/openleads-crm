import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { AccountStatus, Profile, Subscription } from '@/types'

interface AuthContextValue {
  user: Profile | null
  subscription: Subscription | null
  loading: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, companyName?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isApproved: boolean
  isAdmin: boolean
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

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      setUser(null)
      setSubscription(null)
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
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!isSupabaseConfigured || !supabase) {
        if (mounted) setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session?.user && mounted) {
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
    if (!supabase) throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await refreshProfile()
  }, [refreshProfile])

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, companyName?: string) => {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, company_name: companyName || '' },
        },
      })
      if (error) throw error
      if (data.user && companyName) {
        await supabase
          .from('profiles')
          .update({ company_name: companyName, full_name: fullName })
          .eq('id', data.user.id)
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setSubscription(null)
  }, [])

  const accountStatus = (user?.account_status || 'pending') as AccountStatus
  const isApproved = accountStatus === 'approved'
  const isAdmin = user?.role === 'admin' && isApproved

  const value = useMemo(
    () => ({
      user,
      subscription,
      loading,
      isDemo: false,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      isApproved,
      isAdmin,
    }),
    [user, subscription, loading, signIn, signUp, signOut, refreshProfile, isApproved, isAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
