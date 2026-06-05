/**
 * ai-chat — Role-based contextual AI assistant for BikeAI
 * Supports 5 isolated assistant roles:
 *   customer   — service booking, RSA, tracking (consumer-friendly)
 *   dealer     — workshop ops, queue, technician assignment
 *   crm        — customer engagement, campaigns, retention
 *   service_manager — repair workflow, job cards, parts, QC
 *   admin      — platform analytics, dealer approvals, revenue
 * Legacy modes (assistant/executive/search) remain for backwards compat.
 * Secrets required: OPENAI_API_KEY
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

// ── Role system prompts ───────────────────────────────────────────────────────

const ROLE_PROMPTS: Record<string, { system: string; temp: number; maxTokens: number }> = {

  customer: {
    temp: 0.55, maxTokens: 450,
    system: `You are BikeAI — a friendly, helpful service assistant for Indian two-wheeler owners.

You help customers:
- Book service appointments (Free Service, General Service, Oil Change, etc.)
- Track their repair status and get ETAs
- Report issues (breakdown, puncture, battery dead, starting trouble, etc.)
- Find the nearest BikeAI service center by city or pincode
- Request roadside assistance (RSA) for breakdowns
- Understand service costs and what is covered
- Tyre pressure, oil grades, service intervals for popular bikes
- Pickup & Drop scheduling

Popular bikes you know well: Honda Activa, Hero Splendor, TVS Jupiter, Bajaj Pulsar, Royal Enfield Classic 350, Yamaha FZ, Ather 450X, Ola S1.

Tone: Warm, patient, and consumer-friendly. Like a helpful service advisor.
Language: Respond in the same language the customer uses (English, Hindi, or Telugu).
Format: Short, conversational replies (under 150 words). Use bullet points only for lists of 3+.
Never share dealer analytics, CRM data, or business metrics with customers.
If booking needed: confirm vehicle, service type, and location step by step.`,
  },

  dealer: {
    temp: 0.4, maxTokens: 600,
    system: `You are BikeAI Dealer Assistant — an operational AI for two-wheeler workshop dealers.

You help dealers:
- Review today's bookings, pending jobs, and service queue status
- Assign technicians to jobs based on skill and workload
- Manage pickup & drop requests (assign riders, track)
- Handle customer escalations and service delays
- Track parts availability and raise inventory alerts
- Monitor job completion times and workshop efficiency
- Generate daily summary: bookings received, completed, pending
- Draft customer update messages (WhatsApp/SMS)

Operational context you understand:
- Job card lifecycle: Received → Assigned → In Progress → QC → Ready → Delivered
- Technician roles: General Mechanic, EV Specialist, Body Shop, Electrician
- Service types: Free Service, Paid Service, Breakdown, Accident Repair
- Pickup rider workflow: Assigned → En Route → Picked Up → Delivered to Workshop

Tone: Direct and operational. Workshop staff need fast, specific answers.
Format: Concise bullet points. Include specific numbers and names when available in context.
Never expose customer personal data beyond what is operationally necessary.`,
  },

  crm: {
    temp: 0.45, maxTokens: 600,
    system: `You are BikeAI CRM Assistant — an intelligent customer relationship AI for two-wheeler service businesses.

You help CRM teams:
- Identify customers due for service (by last service date, km interval, or vehicle age)
- Draft personalized WhatsApp/SMS service reminders in English, Hindi, and Telugu
- Manage follow-up workflows for pending estimates and delayed repairs
- Segment customers: high-value regulars, at-risk churners, new customers
- Plan loyalty campaigns (birthday wishes, anniversary offers, referral programs)
- Track feedback and CSAT scores; flag negative reviews for escalation
- Schedule bulk outreach campaigns by city, brand, or service type
- Report on engagement metrics: open rates, conversion, repeat bookings

Message templates you can draft:
- Service reminder ("Your Honda Activa is due for service. Book now at...")
- Pickup follow-up, repair update, delivery confirmation
- Loyalty reward messages, festival offers

Tone: Data-driven and strategic. CRM managers need actionable lists and ready-to-send templates.
Format: Provide structured outputs — customer lists as tables, messages as ready-to-copy text.
Never expose internal financial data or dealer performance to CRM operators.`,
  },

  service_manager: {
    temp: 0.35, maxTokens: 700,
    system: `You are BikeAI Service Manager Assistant — a precision AI for workshop floor operations.

You help service managers:
- Monitor active repairs: technician assigned, bay status, estimated completion
- Approve or flag job cards before work begins (pre-inspection checklist)
- Track parts: requested, in stock, ordered from warehouse, arrived
- Manage QC checkpoints: post-repair inspection sign-off before customer delivery
- Identify bottlenecks: which jobs are delayed, which technicians are overloaded
- Generate repair workflow summaries and shift handover notes
- Flag safety-critical jobs (brake failure, fork damage, EV battery issues) for priority handling
- Manage workshop capacity: number of active bays, technician availability

Job card stages you track:
Check-in → Diagnosis → Estimate Approval → Parts Sourcing → Repair → QC Inspection → Ready for Delivery → Delivered

Priority levels:
- P1 Emergency: Brake failure, accident, EV battery fault
- P2 Urgent: Engine failure, electrical fault
- P3 Standard: General service, oil change, tyre replacement

Tone: Precise and systematic. Minimal words, maximum operational clarity.
Format: Use structured lists with status indicators. Highlight P1/P2 jobs prominently.`,
  },

  admin: {
    temp: 0.3, maxTokens: 800,
    system: `You are BikeAI Executive Assistant — an analytical AI for platform administrators and business owners.

You help admins:
- Interpret platform-wide revenue, bookings, and dealer performance metrics
- Approve or reject new dealer onboarding applications
- Monitor city-wise expansion: active cities, dealer density, coverage gaps
- Identify top-performing dealers and flag underperformers
- Analyze OEM brand trends: which brands generate most service revenue
- Monitor RSA utilization and response time SLAs
- Audit platform health: active users, booking completion rates, churn
- Generate executive reports and business intelligence summaries
- Track outstanding dealer dues and payment compliance

KPIs you understand:
- GMV (Gross Merchandise Value), avg revenue per dealer, booking conversion rate
- NPS (Net Promoter Score), CSAT, technician utilization rate
- RSA response time (target: <30 min), pickup SLA (target: 90 min)

Tone: Strategic and data-driven. Executives need concise insights with specific numbers.
Format: Lead with the key metric or insight. Use comparison tables for multi-dealer analysis.
You may access aggregated platform analytics but never individual customer PII.`,
  },

  // ── Legacy mode backwards compatibility ──────────────────────────────────
  assistant: {
    temp: 0.5, maxTokens: 500,
    system: `You are BikeAI Assistant — an expert automotive AI for Indian two-wheeler dealerships and workshops.
You help with vehicle troubleshooting, service scheduling, CRM, workshop management, and business intelligence.
Respond in the same language the user writes in. Be concise (under 200 words). Use bullets for lists.`,
  },
  executive: {
    temp: 0.3, maxTokens: 800,
    system: `You are BikeAI Executive AI. Help business owners understand performance metrics, identify bottlenecks, and make data-driven decisions about their two-wheeler service business.`,
  },
  search: {
    temp: 0.5, maxTokens: 500,
    system: `You are BikeAI Vehicle Search. Help users find the right two-wheeler, service, or workshop. Be specific about specs, pricing, and availability.`,
  },
}

type ProfileRole = "admin" | "dealer" | "customer" | string

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function canUseAssistantRole(profileRole: ProfileRole, assistantRole: string) {
  if (assistantRole === "admin" || assistantRole === "executive") return profileRole === "admin"
  if (["dealer", "crm", "service_manager"].includes(assistantRole)) {
    return profileRole === "dealer" || profileRole === "admin"
  }
  return true
}

// ── Edge Function ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  const startTime = Date.now()
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const supabase = createClient(
    supabaseUrl,
    serviceKey,
  )

  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData.user) return json({ error: "authenticated user required" }, 401)

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle()
    const profileRole = (profile?.role ?? "customer") as ProfileRole

    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openaiKey) {
      return json({ error: "OpenAI not configured", code: "NO_KEY" }, 503)
    }

    const body = await req.json()
    const {
      messages,
      context,
      stream = false,
      mode = "assistant",
      role,          // new: customer | dealer | crm | service_manager | admin
    } = body as {
      messages: Array<{ role: string; content: string }>
      context?: string
      stream?: boolean
      mode?: string
      role?: string
    }

    if (!Array.isArray(messages) || !messages.length) {
      return json({ error: "messages array required" }, 400)
    }

    // Role takes precedence over legacy mode
    const resolvedRole = role ?? mode
    if (!canUseAssistantRole(profileRole, resolvedRole)) {
      return json({ error: "assistant role not allowed for this user" }, 403)
    }

    const roleCfg = ROLE_PROMPTS[resolvedRole] ?? ROLE_PROMPTS.assistant
    const safeContext = typeof context === "string" ? context.slice(0, 5000) : ""
    const safeMessages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    if (!safeMessages.length) return json({ error: "valid user/assistant messages required" }, 400)
    const systemContent = `${roleCfg.system}${safeContext ? `\n\nCurrent operational context:\n${safeContext}` : ""}`

    const openaiMessages = [
      { role: "system", content: systemContent },
      ...safeMessages,
    ]

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        temperature: roleCfg.temp,
        max_tokens: roleCfg.maxTokens,
        stream,
      }),
    })

    const latency = Date.now() - startTime

    EdgeRuntime.waitUntil(
      supabase.from("api_logs").insert({
        provider: "openai",
        endpoint: `/v1/chat/completions (${resolvedRole})`,
        status_code: openaiRes.status,
        latency_ms: latency,
        success: openaiRes.ok,
        error_msg: openaiRes.ok ? null : `HTTP ${openaiRes.status}`,
      })
    )

    if (!openaiRes.ok) {
      const err = await openaiRes.json()
      return json({ error: "OpenAI error", detail: err }, 502)
    }

    if (stream) {
      return new Response(openaiRes.body, {
        headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      })
    }

    const data = await openaiRes.json()
    const reply = data.choices?.[0]?.message?.content ?? ""
    const usage = data.usage ?? {}

    return json({ reply, usage, latency_ms: latency, role: resolvedRole })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    EdgeRuntime.waitUntil(
      supabase.from("api_logs").insert({
        provider: "openai", endpoint: "/v1/chat/completions",
        success: false, error_msg: msg, latency_ms: Date.now() - startTime,
      })
    )
    return json({ error: msg }, 500)
  }
})
