import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

interface SearchRequest {
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  oem?: string;          // OEM slug e.g. "yamaha", "honda"
  service_category?: string;  // service category id
  radius_km?: number;
  limit?: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rateLimit(req: Request, limit = 90, windowMs = 60_000) {
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown")
    .split(",")[0]
    .trim();
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function cleanText(value: unknown, max = 80) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new Error("text parameter too long");
  if (!/^[\p{L}\p{N}\s._-]+$/u.test(trimmed)) throw new Error("invalid text parameter");
  return trimmed;
}

function cleanSlug(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(trimmed)) throw new Error("invalid slug parameter");
  return trimmed;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = value == null ? fallback : Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("invalid numeric parameter");
  return Math.min(max, Math.max(min, numberValue));
}

function sanitizeParams(params: SearchRequest): SearchRequest {
  const lat = params.lat == null ? undefined : Number(params.lat);
  const lng = params.lng == null ? undefined : Number(params.lng);
  if ((lat == null) !== (lng == null)) throw new Error("lat and lng must be provided together");
  if (lat != null && (lat < -90 || lat > 90 || lng! < -180 || lng! > 180)) {
    throw new Error("invalid coordinates");
  }
  return {
    lat,
    lng,
    city: cleanText(params.city),
    state: cleanText(params.state),
    oem: cleanSlug(params.oem),
    service_category: cleanSlug(params.service_category),
    radius_km: clampNumber(params.radius_km, 30, 1, 50),
    limit: Math.floor(clampNumber(params.limit, 10, 1, 20)),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method not allowed", results: [], total: 0 }, 405);
  }
  if (!rateLimit(req)) {
    return json({ error: "rate limit exceeded", results: [], total: 0 }, 429);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    let params: SearchRequest = {};

    if (req.method === "GET") {
      const url = new URL(req.url);
      params = {
        lat: url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : undefined,
        lng: url.searchParams.get("lng") ? Number(url.searchParams.get("lng")) : undefined,
        city: url.searchParams.get("city") || undefined,
        state: url.searchParams.get("state") || undefined,
        oem: url.searchParams.get("oem") || undefined,
        service_category: url.searchParams.get("service_category") || undefined,
        radius_km: url.searchParams.get("radius_km") ? Number(url.searchParams.get("radius_km")) : 30,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 10,
      };
    } else {
      params = await req.json();
    }
    params = sanitizeParams(params);

    const radius = params.radius_km ?? 30;
    const maxResults = Math.min(params.limit ?? 10, 20);
    const oemSlug = params.oem?.toLowerCase() || null;
    const serviceCat = params.service_category || null;

    // ── Path 1: Geo-based search (lat/lng provided) ──────────────────────────
    if (params.lat != null && params.lng != null) {
      const { data, error } = await supabase.rpc("nearby_service_centers", {
        p_lat: params.lat,
        p_lng: params.lng,
        p_radius_km: radius,
        p_oem_slug: oemSlug,
        p_service_cat: serviceCat,
        p_limit: maxResults,
      });

      if (error) throw error;

      return new Response(JSON.stringify({
        results: data ?? [],
        query: { lat: params.lat, lng: params.lng, radius_km: radius, oem: oemSlug, service_category: serviceCat },
        total: data?.length ?? 0,
        method: "geo",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Path 2: City/state-based search (no coordinates) ────────────────────
    if (params.city) {
      let query = supabase
        .from("service_centers")
        .select(
          "id, name, address, city, state, pincode, phone, lat, lng, rating, total_reviews, " +
          "brands, supported_oems, supported_services, pickup_radius_km, live_capacity, " +
          "workshop_type, total_bays, is_pickup_available, next_available_slot, open_time, close_time"
        )
        .eq("is_active", true)
        .eq("status", "active")
        .ilike("city", `%${params.city}%`)
        .limit(maxResults);

      if (params.state) {
        query = query.ilike("state", `%${params.state}%`);
      }

      if (oemSlug) {
        query = query.contains("supported_oems", [oemSlug]);
      }

      if (serviceCat) {
        query = query.contains("supported_services", [serviceCat]);
      }

      query = query.order("rating", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Geocode the city to get coordinates for the response
      let cityCoords: { lat: number; lng: number } | null = null;
      const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || Deno.env.get("GOOGLE_MAPS_KEY");
      if (mapsKey) {
        try {
          const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(params.city + ", India")}&key=${mapsKey}`;
          const geoRes = await fetch(geoUrl);
          const geoJson = await geoRes.json();
          const loc = geoJson.results?.[0]?.geometry?.location;
          if (loc) cityCoords = { lat: loc.lat, lng: loc.lng };
        } catch { /* non-fatal */ }
      }

      // Attach client-computed distance if we got city coordinates
      let results = data ?? [];
      if (cityCoords) {
        results = results.map((sc: Record<string, unknown>) => ({
          ...sc,
          distance_km: haversineKm(
            cityCoords!.lat, cityCoords!.lng,
            Number(sc.lat), Number(sc.lng)
          ),
        })).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          (Number(a.distance_km) || 999) - (Number(b.distance_km) || 999)
        );
      }

      return new Response(JSON.stringify({
        results,
        query: { city: params.city, state: params.state, oem: oemSlug, service_category: serviceCat },
        total: results.length,
        method: "city",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Path 3: OEM/service only (broad search, fallback) ───────────────────
    let query = supabase
      .from("service_centers")
      .select(
        "id, name, address, city, state, pincode, phone, lat, lng, rating, total_reviews, " +
        "brands, supported_oems, supported_services, pickup_radius_km, live_capacity, " +
        "workshop_type, total_bays, is_pickup_available, next_available_slot, open_time, close_time"
      )
      .eq("is_active", true)
      .eq("status", "active")
      .limit(maxResults);

    if (oemSlug) query = query.contains("supported_oems", [oemSlug]);
    if (serviceCat) query = query.contains("supported_services", [serviceCat]);
    query = query.order("rating", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return json({
      results: data ?? [],
      query: { oem: oemSlug, service_category: serviceCat },
      total: data?.length ?? 0,
      method: "broad",
    });

  } catch (err) {
    return json({ error: String(err), results: [], total: 0 }, 400);
  }
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
