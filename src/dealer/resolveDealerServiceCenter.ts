import { api, safeGet } from '../lib/api'

export interface DealerServiceCenter {
  id: string
  name: string
  city: string
  phone?: string | null
}

export async function resolveDealerServiceCenter(user: { id: string }, columns = 'id,name,city') {
  try {
    // Preferred backend approach: let backend resolve scope for dealer/crm/service_manager.
    // TODO: Confirm backend endpoint for resolving dealer service center by current user.
    const resolved = await safeGet<DealerServiceCenter | null>(
      `/api/dealer/resolve-service-center?columns=${encodeURIComponent(columns)}`,
      null,
    )
    if (resolved) return { center: resolved, error: '' }
  } catch {
    // ignore, fallback below
  }

  // Fallback: attempt to resolve via /api/auth/me + service-centers queries if those exist.
  // This keeps the UI from crashing even if endpoints are missing.
  try {
    // TODO: Confirm backend endpoint GET /api/auth/me returns preferred_center_id for staff accounts.
    const me = await api.get<{ profile?: { role?: string; preferred_center_id?: string | null } }>('/api/auth/me')
    const role = String(me?.profile?.role || '')
    const preferredCenterId = typeof me?.profile?.preferred_center_id === 'string' ? me.profile.preferred_center_id : ''

    if ((role === 'crm' || role === 'service_manager') && preferredCenterId) {
      const assigned = await safeGet<DealerServiceCenter | null>(
        `/api/service-centers/${encodeURIComponent(preferredCenterId)}?columns=${encodeURIComponent(columns)}`,
        null,
      )
      if (assigned) return { center: assigned, error: '' }
      return { center: null, error: 'No assigned workshop was found for this staff account.' }
    }

    const owned = await safeGet<DealerServiceCenter | null>(
      `/api/service-centers/owned?ownerId=${encodeURIComponent(user.id)}&columns=${encodeURIComponent(columns)}`,
      null,
    )
    if (owned) return { center: owned, error: '' }
  } catch {
    // ignore
  }

  // Last resort: do not attempt Supabase RPC auto-claim; backend should own this flow.
  // TODO: Backend missing auto-claim flow for dealer service center.
  return { center: null, error: '' }
}
