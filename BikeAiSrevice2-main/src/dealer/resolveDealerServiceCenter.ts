import { api, safeGet } from '../lib/api'

export interface DealerServiceCenter {
  id: string
  name: string
  city: string
  phone?: string | null
}

type AuthMeResponse = {
  id?: string
  role?: string | null
  staffOfDealerId?: string | null
  preferred_center_id?: string | null
  service_center_id?: string | null
  dealerId?: string | null
  dealer_id?: string | null
  user?: {
    id?: string
    role?: string | null
    staffOfDealerId?: string | null
    preferred_center_id?: string | null
    service_center_id?: string | null
    dealerId?: string | null
    dealer_id?: string | null
  }
  profile?: {
    role?: string | null
    preferred_center_id?: string | null
    service_center_id?: string | null
    staffOfDealerId?: string | null
    dealerId?: string | null
    dealer_id?: string | null
  }
}

function pickCenterId(me: AuthMeResponse | null | undefined) {
  return (
    me?.staffOfDealerId ||
    me?.service_center_id ||
    me?.preferred_center_id ||
    me?.dealerId ||
    me?.dealer_id ||
    me?.user?.staffOfDealerId ||
    me?.user?.service_center_id ||
    me?.user?.preferred_center_id ||
    me?.user?.dealerId ||
    me?.user?.dealer_id ||
    me?.profile?.staffOfDealerId ||
    me?.profile?.service_center_id ||
    me?.profile?.preferred_center_id ||
    me?.profile?.dealerId ||
    me?.profile?.dealer_id ||
    ''
  )
}

export async function resolveDealerServiceCenter(user: { id: string }, columns = 'id,name,city') {
  try {
    const resolved = await safeGet<DealerServiceCenter | null>(
      `/api/dealer/resolve-service-center?columns=${encodeURIComponent(columns)}`,
      null,
    )
    if (resolved) return { center: resolved, error: '' }
  } catch {
    // ignore, fallback below
  }

  try {
    const me = await api.get<AuthMeResponse>('/api/auth/me')
    const centerId = pickCenterId(me)

    if (centerId) {
      const assigned = await safeGet<DealerServiceCenter | null>(
        `/api/dealers/${encodeURIComponent(centerId)}`,
        null,
      )

      if (assigned) {
        return {
          center: {
            id: assigned.id,
            name: assigned.name,
            city: assigned.city,
            phone: assigned.phone ?? null,
          },
          error: '',
        }
      }

      return { center: null, error: 'No assigned workshop was found for this dealer account.' }
    }

    const owned = await safeGet<DealerServiceCenter | null>(
      `/api/service-centers/owned?ownerId=${encodeURIComponent(user.id)}&columns=${encodeURIComponent(columns)}`,
      null,
    )
    if (owned) return { center: owned, error: '' }
  } catch {
    // ignore
  }

  return { center: null, error: '' }
}