import { useState, useEffect, createContext, useContext } from 'react'
import { api, getStoredAuth, setStoredAuth } from '../lib/api'
import { Profile } from '../types'

type DealerLoginUser = {
  id?: string
  email?: string | null
  role?: string | null
  preferred_center_id?: string | null
  service_center_id?: string | null
}

interface DealerAuthContextType {
  user: { id: string; email?: string | null } | null
  session: { access_token: string } | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, phone: string, businessName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const DealerAuthContext = createContext<DealerAuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useDealerAuth() {
  return useContext(DealerAuthContext)
}

export function useDealerAuthProvider(): DealerAuthContextType {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null)
  const [session, setSession] = useState<{ access_token: string } | null>(null)
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
    setProfile(stored.profile?.id ? ({
      id: stored.profile.id,
      role: stored.profile.role,
      preferred_center_id: stored.profile.preferred_center_id || stored.profile.service_center_id || null,
      service_center_id: stored.profile.service_center_id || stored.profile.preferred_center_id || null,
    } as Profile & { service_center_id?: string | null }) : null)
  }

  const refreshProfile = async () => {
    try {
      if (!session?.access_token) return
      const me = await api.get<{ profile?: Profile; user?: { id: string; email?: string | null; role?: string | null } }>('/api/auth/me', session.access_token)
      if (me?.profile) {
        setProfile(me.profile)
        const current = getStoredAuth()
        if (current?.token) setStoredAuth({ ...current, profile: { id: me.profile.id, role: me.profile.role } })
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
      const res = await api.post<{ token?: string; accessToken?: string; user?: DealerLoginUser; profile?: Profile }>(
        '/api/auth/login',
        { email, password },
      )
      const token = res.token || res.accessToken
      const userId = res.user?.id
      if (!token || !userId) throw new Error('Invalid login response')
      const fallbackProfile = res.user?.role
        ? ({
            id: userId,
            full_name: '',
            phone: '',
            avatar_url: '',
            email: res.user.email || email,
            role: res.user.role as Profile['role'],
            preferred_center_id: res.user.preferred_center_id || res.user.service_center_id || null,
            service_center_id: res.user.service_center_id || res.user.preferred_center_id || null,
            is_active: true,
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString(),
          } as Profile & { service_center_id?: string | null })
        : null
      const nextProfile = res.profile ?? fallbackProfile

      setStoredAuth({
        token,
        user: { id: userId, email: res.user?.email || email },
        profile: nextProfile
          ? {
              id: nextProfile.id,
              role: nextProfile.role,
              preferred_center_id: nextProfile.preferred_center_id,
              service_center_id: (nextProfile as Profile & { service_center_id?: string | null }).service_center_id,
            }
          : res.user?.role
            ? { id: userId, role: res.user.role }
            : { id: userId, role: null },
      })

      setUser({ id: userId, email: res.user?.email || email })
      setSession({ access_token: token })
      setProfile(nextProfile)
      refreshProfile()
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const signUp = async (_email: string, _password: string, _fullName: string, _phone: string, _businessName: string) => {
    // TODO: Backend missing POST /api/auth/register (dealer). Keeping UI safe.
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
