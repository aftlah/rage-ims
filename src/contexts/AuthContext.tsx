import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  buildEmailCandidates,
  isAdminMember,
  logFailedLogin,
  markSessionLogout,
  recordLoginSession,
  resolveMember,
  type Member,
} from '../lib/auth'
import { supabase } from '../lib/supabase'

type SignInResult = { error: string | null }

type AuthContextValue = {
  session: Session | null
  user: User | null
  member: Member | null
  isAdmin: boolean
  loading: boolean
  signIn: (usernameOrEmail: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next)
    setUser(next?.user ?? null)
    if (next?.user) {
      const m = await resolveMember(next.user)
      setMember(m)
    } else {
      setMember(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      await applySession(data.session)
      if (mounted) setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void (async () => {
        await applySession(next)
        if (mounted) setLoading(false)
      })()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(async (usernameOrEmail: string, password: string) => {
    const candidates = buildEmailCandidates(usernameOrEmail)
    if (!candidates.length || !password) {
      return { error: 'Username dan password wajib diisi' }
    }

    let lastMessage = 'Username atau password salah.'
    for (const email of candidates) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (!error && data.user) {
        void recordLoginSession(data.user.id)
        return { error: null }
      }
      if (error?.message) lastMessage = error.message
    }

    void logFailedLogin(usernameOrEmail, lastMessage)
    return { error: 'Username atau password salah.' }
  }, [])

  const signOut = useCallback(async () => {
    const uid = user?.id
    if (uid) await markSessionLogout(uid)
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setMember(null)
  }, [user?.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      member,
      isAdmin: isAdminMember(member),
      loading,
      signIn,
      signOut,
    }),
    [session, user, member, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
