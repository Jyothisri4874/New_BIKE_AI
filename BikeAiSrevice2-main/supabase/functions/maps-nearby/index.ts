/**
 * maps-nearby — Google Maps Places + Distance Matrix + Geocoding proxy for BikeAI
 * Handles: nearby workshops, dealer routing, ETA calculations, live geocoding,
 *          EV charging stations, RSA routing, geo-fencing support,
 *          Places Autocomplete for location search
 * Secrets required: GOOGLE_MAPS_KEY
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

type Action = "nearby" | "distance" | "geocode" | "reverse_geocode" | "ev_charging" | "route" | "places_autocomplete" | "place_details"

interface MapsRequest {
  action: Action
  lat?: number
  lng?: number
  address?: string
  radius?: number
  type?: string
  origins?: string[]
  destinations?: string[]
  keyword?: string
  input?: string        // for places_autocomplete
  place_id?: string     // for place_details
  session_token?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function rateLimit(req: Request, limit = 60, windowMs = 60_000) {
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown")
    .split(",")[0]
    .trim()
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

function isValidCoord(lat?: number, lng?: number) {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function cleanText(value: unknown, min: number, max: number) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) return ""
  return trimmed
}

function cleanList(values?: string[], maxItems = 5) {
  if (!Array.isArray(values) || values.length === 0 || values.length > maxItems) return null
  const cleaned = values.map((value) => cleanText(value, 1, 180))
  return cleaned.every(Boolean) ? cleaned : null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)
  if (!rateLimit(req)) return json({ error: "rate limit exceeded" }, 429)
  const startTime = Date.now()

  try {
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("GOOGLE_MAPS_KEY")
    if (!mapsKey) {
      return json({ error: "Google Maps not configured", code: "NO_KEY" }, 503)
    }

    const body = await req.json() as MapsRequest
    const { action, lat, lng, address, radius = 10000, type = "car_repair", origins, destinations, keyword, input, place_id, session_token } = body
    const safeRadius = Math.min(Math.max(Number(radius) || 10000, 100), 50000)
    const safeType = /^[a-z_]{1,60}$/.test(type) ? type : "car_repair"
    const safeKeyword = cleanText(keyword, 0, 100)
    const safeSessionToken = cleanText(session_token, 0, 120)

    let result: unknown

    if (action === "nearby" || action === "ev_charging") {
      if (!isValidCoord(lat, lng)) {
        return json({ error: "valid lat and lng required" }, 400)
      }
      const placeType   = action === "ev_charging" ? "electric_vehicle_charging_station" : safeType
      const searchKw    = safeKeyword || (action === "ev_charging" ? "EV charging station" : "two wheeler service workshop")
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${safeRadius}&type=${placeType}&keyword=${encodeURIComponent(searchKw)}&key=${mapsKey}`
      const res  = await fetch(url)
      const data = await res.json() as { results: unknown[]; status: string; next_page_token?: string }
      result = { places: data.results, status: data.status, count: data.results?.length ?? 0 }

    } else if (action === "places_autocomplete") {
      const safeInput = cleanText(input, 2, 120)
      if (!safeInput) {
        return json({ error: "input required for places_autocomplete" }, 400)
      }
      // Bias results toward India; if lat/lng provided use location bias
      const params = new URLSearchParams({
        input: safeInput,
        key: mapsKey,
        components: "country:in",
        language: "en",
        types: "geocode|establishment",
      })
      if (lat != null && lng != null) {
        if (!isValidCoord(lat, lng)) return json({ error: "valid lat and lng required" }, 400)
        params.set("location", `${lat},${lng}`)
        params.set("radius", "50000")
      }
      if (safeSessionToken) params.set("sessiontoken", safeSessionToken)

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
      const res  = await fetch(url)
      const data = await res.json() as {
        predictions: Array<{
          description: string
          place_id: string
          structured_formatting: { main_text: string; secondary_text: string }
          types: string[]
        }>
        status: string
      }
      result = { predictions: data.predictions ?? [], status: data.status }

    } else if (action === "place_details") {
      const safePlaceId = cleanText(place_id, 5, 180)
      if (!safePlaceId) {
        return json({ error: "place_id required for place_details" }, 400)
      }
      const params = new URLSearchParams({
        place_id: safePlaceId,
        key: mapsKey,
        fields: "geometry,formatted_address,address_components,name",
        language: "en",
      })
      if (safeSessionToken) params.set("sessiontoken", safeSessionToken)

      const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`
      const res  = await fetch(url)
      const data = await res.json() as { result: unknown; status: string }
      result = { detail: data.result, status: data.status }

    } else if (action === "distance") {
      const safeOrigins = cleanList(origins)
      const safeDestinations = cleanList(destinations)
      if (!safeOrigins || !safeDestinations) {
        return json({ error: "origins and destinations required" }, 400)
      }
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(safeOrigins.join("|"))}&destinations=${encodeURIComponent(safeDestinations.join("|"))}&mode=driving&region=IN&key=${mapsKey}`
      const res  = await fetch(url)
      result = await res.json()

    } else if (action === "geocode") {
      const safeAddress = cleanText(address, 3, 200)
      if (!safeAddress) {
        return json({ error: "address required for geocode" }, 400)
      }
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(safeAddress)}&region=IN&key=${mapsKey}`
      const res  = await fetch(url)
      const data = await res.json() as { results: unknown[]; status: string }
      result = { locations: data.results, status: data.status }

    } else if (action === "reverse_geocode") {
      if (!isValidCoord(lat, lng)) {
        return json({ error: "valid lat and lng required for reverse_geocode" }, 400)
      }
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=IN&key=${mapsKey}`
      const res  = await fetch(url)
      const data = await res.json() as { results: unknown[]; status: string }
      result = { locations: data.results, status: data.status }

    } else if (action === "route") {
      const safeOrigins = cleanList(origins, 1)
      const safeDestinations = cleanList(destinations, 1)
      if (!safeOrigins || !safeDestinations) {
        return json({ error: "origins and destinations required for route" }, 400)
      }
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(safeOrigins[0])}&destination=${encodeURIComponent(safeDestinations[0])}&mode=driving&region=IN&key=${mapsKey}`
      const res  = await fetch(url)
      result = await res.json()

    } else {
      return json({ error: "action must be nearby|distance|geocode|reverse_geocode|ev_charging|route|places_autocomplete|place_details" }, 400)
    }

    return json({ ...(result as object), latency_ms: Date.now() - startTime })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return json({ error: msg }, 500)
  }
})
