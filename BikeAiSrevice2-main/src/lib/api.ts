/**
 * BikeAI Frontend API Service Layer
 * All external API calls go through BikeAI MySQL backend API.
 * API keys never appear in frontend code.
 */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://api.bikeai.in"
const BASE = String(RAW_BASE).replace(/\/+$/, "").replace(/\/api$/, "")

// Keep auth storage centralized so hooks/components stay minimal.
const AUTH_STORAGE_KEY = "bikeai_auth_v1"

export type StoredAuth = {
  token: string
  user: { id: string; email?: string | null } | null
  profile: { id: string; role?: string | null; preferred_center_id?: string | null; service_center_id?: string | null } | null
}

export function getStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export function setStoredAuth(next: StoredAuth | null) {
  try {
    if (!next) localStorage.removeItem(AUTH_STORAGE_KEY)
    else localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

export function getAuthToken(): string | null {
  return getStoredAuth()?.token ?? null
}

function authHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

type ApiErrorPayload = { error?: string; message?: string; details?: unknown }

async function parseApiError(res: Response): Promise<string> {
  const textFallback = res.statusText || `HTTP ${res.status}`
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return textFallback
  const payload = (await res.json().catch(() => null)) as ApiErrorPayload | null
  return payload?.error || payload?.message || textFallback
}

async function requestJson<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  opts: { body?: unknown; token?: string; allowEmpty?: boolean } = {},
): Promise<T> {
  const token = opts.token ?? getAuthToken() ?? undefined
  const urlPath = path.startsWith("/") ? path : `/${path}`
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: authHeaders(token),
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  })
  if (!res.ok) throw new Error(await parseApiError(res))
  if (opts.allowEmpty && res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function safeGet<T>(path: string, fallback: T, token?: string): Promise<T> {
  try {
    return await requestJson<T>("GET", path, { token })
  } catch {
    return fallback
  }
}

// Back-compat helpers used across the codebase.
// These mimic a small subset of the "supabase-style" call sites without touching UI.
export async function apiGet<T>(path: string, token?: string): Promise<T> {
  return api.get<T>(path, token)
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const data = await api.post<T>(path, body, token)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

export const api = {
  get<T>(path: string, token?: string) {
    return requestJson<T>("GET", path, { token })
  },
  post<T>(path: string, body?: unknown, token?: string) {
    return requestJson<T>("POST", path, { body: body ?? {}, token })
  },
  put<T>(path: string, body?: unknown, token?: string) {
    return requestJson<T>("PUT", path, { body: body ?? {}, token })
  },
  patch<T>(path: string, body?: unknown, token?: string) {
    return requestJson<T>("PATCH", path, { body: body ?? {}, token })
  },
  delete<T>(path: string, token?: string) {
    return requestJson<T>("DELETE", path, { token, allowEmpty: true })
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export type ChatMode = "assistant" | "crm" | "executive" | "search"
export type AssistantRole = "customer" | "dealer" | "crm" | "service_manager" | "admin" | ChatMode

export interface ChatResponse {
  reply: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  latency_ms: number
  role: AssistantRole
}

export interface NearbyPlace {
  name: string
  vicinity: string
  geometry: { location: { lat: number; lng: number } }
  rating?: number
  user_ratings_total?: number
  opening_hours?: { open_now: boolean }
  place_id: string
  types?: string[]
}

export interface NearbyResponse {
  places: NearbyPlace[]
  status: string
  count: number
  latency_ms: number
}

export interface DistanceRow {
  elements: Array<{
    distance: { text: string; value: number }
    duration: { text: string; value: number }
    status: string
  }>
}

export interface DistanceResponse {
  rows: DistanceRow[]
  origin_addresses: string[]
  destination_addresses: string[]
  status: string
  latency_ms: number
}

export interface GeocodeResult {
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  place_id: string
  address_components: Array<{ long_name: string; short_name: string; types: string[] }>
}

export interface GeocodeResponse {
  locations: GeocodeResult[]
  status: string
  latency_ms: number
}

export type TwilioMessageType =
  | "otp"
  | "booking_confirmation"
  | "booking_reminder"
  | "pickup_assigned"
  | "pickup_arrived"
  | "delivery_confirmed"
  | "service_ready"
  | "invoice"
  | "rsa_alert"
  | "crm_followup"
  | "custom"

export interface TwilioSendRequest {
  to: string
  channel?: "sms" | "whatsapp"
  type: TwilioMessageType
  body?: string
  variables?: Record<string, string>
  customer_id?: string
  booking_id?: string
  job_id?: string
}

export interface TwilioSendResponse {
  success: boolean
  sid: string | null
  status: string
  latency_ms: number
}

export interface CustomerOtpRequestResponse {
  success: boolean
  session_id?: string
  expires_at?: string
  message?: string
}

export type CustomerOtpChannel = "whatsapp" | "sms"

export interface CustomerOtpVerifyResponse {
  success: boolean
  token?: string
  accessToken?: string
  user?: { id?: string; email?: string | null; role?: string | null }
  profile?: { id: string; role?: string | null }
  is_new_user?: boolean
  email?: string | null
  message?: string
}

export interface CustomerPhoneCheckResponse {
  exists: boolean
}

// ─── OpenAI / AI Chat ─────────────────────────────────────────────────────────

export function aiChat(
  messages: ChatMessage[],
  opts: { context?: string; mode?: ChatMode; role?: AssistantRole } = {},
  token?: string,
) {
  return api.post<ChatResponse>("/api/ai-chat", { messages, ...opts }, token)
}

// ─── Google Maps ──────────────────────────────────────────────────────────────

export function mapsNearbyWorkshops(
  lat: number, lng: number,
  opts: { radius?: number; keyword?: string } = {},
  token?: string,
) {
  return api.post<NearbyResponse>("/api/maps-nearby", {
    action: "nearby", lat, lng,
    radius: opts.radius ?? 10000,
    keyword: opts.keyword ?? "two wheeler service workshop",
  }, token)
}

export function mapsNearbyEVCharging(lat: number, lng: number, radius = 10000, token?: string) {
  return api.post<NearbyResponse>("/api/maps-nearby", { action: "ev_charging", lat, lng, radius }, token)
}

export function mapsDistance(origins: string[], destinations: string[], token?: string) {
  return api.post<DistanceResponse>("/api/maps-nearby", { action: "distance", origins, destinations }, token)
}

export function mapsGeocode(address: string, token?: string) {
  return api.post<GeocodeResponse>("/api/maps-nearby", { action: "geocode", address }, token)
}

export function mapsReverseGeocode(lat: number, lng: number, token?: string) {
  return api.post<GeocodeResponse>("/api/maps-nearby", { action: "reverse_geocode", lat, lng }, token)
}

export function mapsRoute(origin: string, destination: string, token?: string) {
  return api.post<unknown>("/api/maps-nearby", { action: "route", origins: [origin], destinations: [destination] }, token)
}

export interface PlacesPrediction {
  description: string
  place_id: string
  structured_formatting: { main_text: string; secondary_text: string }
  types: string[]
}

export interface PlacesAutocompleteResponse {
  predictions: PlacesPrediction[]
  status: string
  latency_ms: number
}

export interface PlaceDetailResult {
  geometry: { location: { lat: number; lng: number } }
  formatted_address: string
  name: string
  address_components: Array<{ long_name: string; short_name: string; types: string[] }>
}

export interface PlaceDetailResponse {
  detail: PlaceDetailResult
  status: string
  latency_ms: number
}

export function mapsPlacesAutocomplete(
  input: string,
  opts: { lat?: number; lng?: number; sessionToken?: string } = {},
  token?: string,
) {
  return api.post<PlacesAutocompleteResponse>("/api/maps-nearby", {
    action: "places_autocomplete",
    input,
    lat: opts.lat,
    lng: opts.lng,
    session_token: opts.sessionToken,
  }, token)
}

export function mapsPlaceDetails(placeId: string, sessionToken?: string, token?: string) {
  return api.post<PlaceDetailResponse>("/api/maps-nearby", {
    action: "place_details",
    place_id: placeId,
    session_token: sessionToken,
  }, token)
}

// ─── Twilio SMS / WhatsApp ────────────────────────────────────────────────────

export function twilioSend(req: TwilioSendRequest, token?: string) {
  return api.post<TwilioSendResponse>("/api/twilio-send", req, token)
}

export function requestCustomerOtp(phone: string, channel: CustomerOtpChannel = "whatsapp", token?: string) {
  return api.post<CustomerOtpRequestResponse>("/api/customer-otp/request", {
    phone,
    channel,
  }, token)
}

export function requestCustomerWhatsappOtp(phone: string, token?: string) {
  return requestCustomerOtp(phone, "whatsapp", token)
}

export function verifyCustomerOtp(
  phone: string,
  otp: string,
  sessionId?: string,
  channel: CustomerOtpChannel = "whatsapp",
  token?: string,
) {
  return api.post<CustomerOtpVerifyResponse>("/api/customer-otp/verify", {
    phone,
    code: otp,
    session_id: sessionId,
    channel,
  }, token)
}

export function verifyCustomerWhatsappOtp(
  phone: string,
  otp: string,
  sessionId?: string,
  token?: string,
) {
  return verifyCustomerOtp(phone, otp, sessionId, "whatsapp", token)
}

export function checkCustomerPhone(phone: string, token?: string) {
  return api.get<CustomerPhoneCheckResponse>(`/api/customer-auth/check-phone?phone=${encodeURIComponent(phone)}`, token)
}

export function customerPasswordLogin(phone: string, password: string, token?: string) {
  return api.post<CustomerOtpVerifyResponse>("/api/auth/login", {
    identifier: phone,
    password,
  }, token)
}

export function sendBookingConfirmation(
  phone: string,
  vars: { service_type: string; date: string; time: string; center: string; booking_id: string },
  opts: { channel?: "sms" | "whatsapp"; customer_id?: string; booking_id?: string } = {},
) {
  return twilioSend({ to: phone, type: "booking_confirmation", variables: vars, ...opts })
}

export function sendBookingReminder(
  phone: string,
  vars: { service_type: string; time: string; center: string },
  opts: { channel?: "sms" | "whatsapp"; booking_id?: string } = {},
) {
  return twilioSend({ to: phone, type: "booking_reminder", variables: vars, ...opts })
}

export function sendPickupOTP(
  phone: string,
  otp: string,
  opts: { job_id?: string; customer_id?: string } = {},
) {
  return twilioSend({ to: phone, type: "pickup_arrived", variables: { otp }, channel: "sms", ...opts })
}

export function sendRSAAlert(phone: string, eta: string, job_id?: string) {
  return twilioSend({ to: phone, type: "rsa_alert", variables: { eta }, channel: "sms", job_id })
}

export function sendServiceReady(
  phone: string,
  vars: { vehicle: string; amount: string; center: string; closing_time: string },
  opts: { booking_id?: string; customer_id?: string } = {},
) {
  return twilioSend({ to: phone, type: "service_ready", variables: vars, ...opts })
}

export function sendCRMFollowup(
  phone: string,
  vars: { name: string; vehicle: string; booking_url: string },
  customer_id?: string,
) {
  return twilioSend({ to: phone, type: "crm_followup", variables: vars, channel: "whatsapp", customer_id })
}

// ─── Dealer Discovery Engine ──────────────────────────────────────────────────

export interface DealerResult {
  id: string
  name: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  lat: number
  lng: number
  rating: number
  total_reviews: number
  brands: string[]
  supported_oems: string[]
  supported_services: string[]
  pickup_radius_km: number
  live_capacity: number
  workshop_type: 'oem_authorized' | 'multi_brand' | 'ev_specialist'
  total_bays: number
  is_pickup_available: boolean
  next_available_slot: string
  open_time: string
  close_time: string
  distance_km?: number
}

export interface DealerSearchParams {
  lat?: number
  lng?: number
  city?: string
  state?: string
  oem?: string
  service_category?: string
  radius_km?: number
  limit?: number
}

export interface DealerSearchResponse {
  results: DealerResult[]
  query: DealerSearchParams
  total: number
  method: 'geo' | 'city' | 'broad'
}

export async function dealerSearch(
  params: DealerSearchParams,
  token?: string,
): Promise<DealerSearchResponse> {
  const qs = new URLSearchParams()
  if (params.lat != null) qs.set('lat', String(params.lat))
  if (params.lng != null) qs.set('lng', String(params.lng))
  if (params.city) qs.set('city', params.city)
  if (params.state) qs.set('state', params.state)
  if (params.oem) qs.set('oem', params.oem)
  if (params.service_category) qs.set('service_category', params.service_category)
  if (params.radius_km) qs.set('radius_km', String(params.radius_km))
  if (params.limit) qs.set('limit', String(params.limit))

  const res = await fetch(`${BASE}/api/dealers/search?${qs.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<DealerSearchResponse>
}

// ─── Geolocation helper (browser) ────────────────────────────────────────────

export function getBrowserLocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { timeout: 8000, maximumAge: 60000 },
    )
  })
}

export function coordsToString(lat: number, lng: number): string {
  return `${lat},${lng}`
}
