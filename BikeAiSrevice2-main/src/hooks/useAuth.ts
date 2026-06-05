import { useState, useEffect, createContext, useContext } from 'react'
import { api, getStoredAuth, setStoredAuth } from '../lib/api'
import { Profile } from '../types'

type AuthUser = { id: string; email?: string | null }
type AuthSession = { access_token: string }

type LoginResponse = {
  token?: string
  accessToken?: string
  user?: { id?: string; email?: string | null; role?: string | null }
  profile?: Profile
}

interface AuthContextType {
  user: AuthUser | null
  session: AuthSession | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const hydrateFromStorage = () => {
    const stored = getStoredAuth()
    if (!stored?.token || !stored.user?.id) {
      setUser(null)
      setSession(null)
      setProfile(null)
      return
    }
    setUser({ id: stored.user.id, email: stored.user.email })
    setSession({ access_token: stored.token })
    if (stored.profile?.id) {
      setProfile(stored.profile as Profile)
    } else {
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    // Optional: if backend provides /api/auth/me, we can hydrate profile from it.
    try {
      if (!session?.access_token) return
      const me = await api.get<{ profile?: Profile; user?: { id: string; email?: string | null; role?: string | null } }>('/api/auth/me', session.access_token)
      if (me?.profile) {
        setProfile(me.profile)
        const current = getStoredAuth()
        if (current?.token) {
          setStoredAuth({ ...current, profile: { id: me.profile.id, role: me.profile.role } })
        }
      }
    } catch {
      // TODO: Backend missing GET /api/auth/me — profile refresh is disabled safely.
    }
  }

  useEffect(() => {
    hydrateFromStorage()
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const res = await api.post<LoginResponse>('/api/auth/login', { email, password })
      const token = res.token || res.accessToken
      if (!token) throw new Error('Login failed: missing token')

      const userId = res.user?.id
      if (!userId) throw new Error('Login failed: missing user')

      const nextProfile: Profile | null =
        res.profile ||
        (res.user?.role
          ? ({
              id: userId,
              full_name: '',
              phone: '',
              avatar_url: '',
              email: res.user?.email || email,
              role: res.user.role as Profile['role'],
              is_active: true,
              created_at: new Date(0).toISOString(),
              updated_at: new Date(0).toISOString(),
            } as Profile)
          : null)

      setStoredAuth({
        token,
        user: { id: userId, email: res.user?.email || email },
        profile: nextProfile ? { id: nextProfile.id, role: nextProfile.role } : { id: userId, role: null },
      })

      setUser({ id: userId, email: res.user?.email || email })
      setSession({ access_token: token })
      setProfile(nextProfile)

      // If backend has /api/auth/me, fetch the full profile (non-fatal).
      refreshProfile()
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const signUp = async (_email: string, _password: string, _fullName: string, _role = 'customer') => {
    // TODO: Backend missing POST /api/auth/register (or equivalent). Keeping UI safe.
    return { error: new Error('Registration is not available yet. Please contact support.') }
  }

  const signOut = async () => {
    setStoredAuth(null)
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return { user, session, profile, loading, signIn, signUp, signOut, refreshProfile }
}
