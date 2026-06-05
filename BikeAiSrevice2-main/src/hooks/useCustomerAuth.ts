import { useState, useEffect, createContext, useContext } from 'react'
import { api, getStoredAuth, setStoredAuth } from '../lib/api'
import { Profile } from '../types'

interface CustomerAuthContextType {
  user: { id: string; email?: string | null } | null
  session: { access_token: string } | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, phone: string, opts?: CustomerSignUpOptions) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

interface CustomerSignUpOptions {
  otpSessionId?: string
  channel?: 'sms' | 'whatsapp'
}

interface AuthResponse {
  token?: string
  accessToken?: string
  user?: { id?: string; email?: string | null; role?: string | null }
  profile?: Profile
}

export const CustomerAuthContext = createContext<CustomerAuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useCustomerAuth() {
  return useContext(CustomerAuthContext)
}

export function useCustomerAuthProvider(): CustomerAuthContextType {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null)
  const [session, setSession] = useState<{ access_token: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const applyAuthResponse = (res: AuthResponse, fallbackEmail?: string) => {
    const token = res.token || res.accessToken
    const userId = res.user?.id || res.profile?.id
    if (!token || !userId) throw new Error('Invalid auth response')

    const nextUser = { id: userId, email: res.user?.email || res.profile?.email || fallbackEmail || null }
    const nextProfile = res.profile
      ? { id: res.profile.id, role: res.profile.role }
      : { id: userId, role: res.user?.role || 'customer' }

    setStoredAuth({
      token,
      user: nextUser,
      profile: nextProfile,
    })

    setUser(nextUser)
    setSession({ access_token: token })
    setProfile((res.profile ?? ({ id: userId, role: nextProfile.role } as Profile)) as Profile)
  }

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
    setProfile(stored.profile?.id ? ({ id: stored.profile.id, role: stored.profile.role } as Profile) : null)
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
      const res = await api.post<AuthResponse>(
        '/api/auth/login',
        { email, password },
      )
      applyAuthResponse(res, email)
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const signUp = async (email: string, password: string, fullName: string, phone: string, opts: CustomerSignUpOptions = {}) => {
    try {
      const res = await api.post<AuthResponse>(
        '/api/auth/register',
        {
          email,
          password,
          fullName,
          phone,
          role: 'customer',
          otpSessionId: opts.otpSessionId,
          session_id: opts.otpSessionId,
          channel: opts.channel || 'whatsapp',
        },
      )

      if (res.token || res.accessToken) {
        applyAuthResponse(res, email)
      } else {
        const loginRes = await api.post<AuthResponse>('/api/auth/login', { email, password })
        applyAuthResponse(loginRes, email)
      }
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const signOut = async () => {
    setStoredAuth(null)
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return { user, session, profile, loading, signIn, signUp, signOut, refreshProfile }
}
