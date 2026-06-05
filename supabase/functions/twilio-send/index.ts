/**
 * twilio-send — Twilio SMS + WhatsApp proxy for BikeAI
 * Handles: OTP, booking confirmations, service reminders, delivery alerts,
 *          CRM follow-ups, emergency alerts, voice call triggers
 * Secrets required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *                   TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_FROM (optional)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

type MessageType =
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

interface SendRequest {
  to: string             // E.164 format: +919876543210
  channel: "sms" | "whatsapp"
  type: MessageType
  body?: string          // for custom type
  variables?: Record<string, string>  // for template interpolation
  customer_id?: string
  booking_id?: string
  job_id?: string
}

interface QueueWorkerRequest {
  action?: string
  queue_id?: string
  service_center_id?: string
  limit?: number
  queue_worker?: boolean
}

interface NotificationQueueRow {
  id: string
  service_center_id: string | null
  customer_id: string | null
  user_id: string | null
  channel: "sms" | "whatsapp" | string
  recipient: string
  body: string
  status: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  delivery_attempts: number | null
  scheduled_at: string | null
}

type ProfileRole = "admin" | "dealer" | "customer" | string

type SupabaseClient = ReturnType<typeof createClient>

interface TwilioConfig {
  accountSid: string
  authToken: string
  fromPhone: string
  fromWA: string
}

interface TwilioResult {
  ok: boolean
  statusCode: number
  latency_ms: number
  data: {
    sid?: string
    status?: string
    error_message?: string
    error_code?: number
  }
}

// Message templates — interpolate {{key}} placeholders
const TEMPLATES: Record<MessageType, string> = {
  otp:                  "Your BikeAI OTP is {{otp}}. Valid for 10 minutes. Do not share.",
  booking_confirmation: "Booking confirmed! Your {{service_type}} is scheduled for {{date}} at {{time}} at {{center}}. Booking ID: {{booking_id}}. - BikeAI",
  booking_reminder:     "Reminder: Your {{service_type}} is tomorrow at {{time}} at {{center}}. Reply HELP for assistance. - BikeAI",
  pickup_assigned:      "Your pickup rider {{rider_name}} is assigned. Track live: {{tracking_url}} ETA: {{eta}}. - BikeAI",
  pickup_arrived:       "Your BikeAI rider has arrived! OTP for handover: {{otp}}. Please share only with rider. - BikeAI",
  delivery_confirmed:   "Your vehicle is delivered! Odometer: {{odometer}} km. Rate your experience: {{rating_url}} - BikeAI",
  service_ready:        "Your {{vehicle}} service is complete! Invoice: ₹{{amount}}. Pickup from {{center}} before {{closing_time}}. - BikeAI",
  invoice:              "Invoice ready for your {{service_type}} service. Amount: ₹{{amount}}. Download: {{invoice_url}} - BikeAI",
  rsa_alert:            "RSA request received! A rider has been dispatched to your location. ETA: {{eta}} mins. BikeAI RSA.",
  crm_followup:         "Hi {{name}}, your {{vehicle}} is due for service. Book now: {{booking_url}} or call us. - BikeAI",
  custom:               "{{body}}",
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function normalizePhone(value = "") {
  return value.replace(/\D/g, "")
}

function toE164(value = "") {
  const trimmed = value.trim()
  if (trimmed.startsWith("+")) return trimmed
  const digits = normalizePhone(trimmed)
  if (digits.length === 10) return `+91${digits}`
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`
  return ""
}

function isAllowedPhone(value: string) {
  return /^\+[1-9]\d{9,14}$/.test(value)
}

function redactSensitivePreview(value: string, type: MessageType) {
  if (type === "otp" || type === "pickup_arrived") {
    return value.replace(/\b\d{4,8}\b/g, "[redacted]")
  }
  return value
}

function isQueueWorkerRequest(value: unknown): value is QueueWorkerRequest {
  const body = value as QueueWorkerRequest
  return body?.action === "process_queue" ||
    body?.action === "process_notification_queue" ||
    body?.queue_worker === true
}

async function sendViaTwilio(
  config: TwilioConfig,
  channel: "sms" | "whatsapp",
  to: string,
  messageBody: string,
): Promise<TwilioResult> {
  const started = Date.now()
  const from = channel === "whatsapp" ? config.fromWA : config.fromPhone
  const toAddr = channel === "whatsapp" ? `whatsapp:${to}` : to
  const credentials = btoa(`${config.accountSid}:${config.authToken}`)

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toAddr, From: from, Body: messageBody }),
    },
  )

  let data: TwilioResult["data"] = {}
  try {
    data = await twilioRes.json()
  } catch {
    data = { error_message: twilioRes.statusText }
  }

  return {
    ok: twilioRes.ok,
    statusCode: twilioRes.status,
    latency_ms: Date.now() - started,
    data,
  }
}

async function logTwilioApiResult(supabase: SupabaseClient, result: TwilioResult) {
  await supabase.from("api_logs").insert({
    provider: "twilio",
    endpoint: "/Messages.json",
    status_code: result.statusCode,
    latency_ms: result.latency_ms,
    success: result.ok,
    error_msg: result.ok ? null : result.data.error_message,
  })
}

function queueBodyPreview(row: NotificationQueueRow) {
  return redactSensitivePreview(row.body, "custom").slice(0, 140)
}

async function upsertCommunicationLog(
  supabase: SupabaseClient,
  row: NotificationQueueRow,
  patch: {
    status: "queued" | "sent" | "failed"
    recipient?: string
    provider_message_id?: string | null
    error_message?: string | null
  },
) {
  const now = new Date().toISOString()
  await supabase.from("communication_logs").upsert({
    service_center_id: row.service_center_id,
    notification_queue_id: row.id,
    customer_id: row.customer_id,
    user_id: row.user_id,
    channel: row.channel,
    direction: "outbound",
    message_type: "service_due_reminder",
    recipient: patch.recipient ?? row.recipient,
    body_preview: queueBodyPreview(row),
    status: patch.status,
    provider: "twilio",
    provider_message_id: patch.provider_message_id ?? null,
    error_message: patch.error_message ?? null,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata ?? {},
    queued_at: patch.status === "queued" ? now : undefined,
    sent_at: patch.status === "sent" ? now : null,
    failed_at: patch.status === "failed" ? now : null,
    updated_at: now,
  }, { onConflict: "notification_queue_id" })
}

async function insertSmsMessageLog(
  supabase: SupabaseClient,
  row: NotificationQueueRow,
  recipient: string,
  result: TwilioResult,
) {
  await supabase.from("sms_messages").insert({
    to_phone: recipient,
    message_type: "crm_followup",
    body_preview: queueBodyPreview(row).slice(0, 100),
    twilio_sid: result.data.sid ?? null,
    status: result.ok ? "sent" : "failed",
    customer_id: row.customer_id,
    booking_id: null,
    job_id: null,
    service_center_id: row.service_center_id,
    error_msg: result.ok ? null : result.data.error_message,
  })
}

async function resolveQueueScope(
  supabase: SupabaseClient,
  userId: string | null,
  profileRole: ProfileRole,
  isServiceRole: boolean,
  serviceCenterId?: string,
): Promise<{ ok: boolean; reason?: string; centerIds: string[] | null }> {
  if (isServiceRole || profileRole === "admin") {
    return { ok: true, centerIds: serviceCenterId ? [serviceCenterId] : null }
  }

  if (profileRole !== "dealer" || !userId) {
    return { ok: false, reason: "dealer or service role queue access required", centerIds: [] }
  }

  let query = supabase.from("service_centers").select("id").eq("owner_id", userId)
  if (serviceCenterId) query = query.eq("id", serviceCenterId)
  const { data, error } = await query
  if (error) return { ok: false, reason: error.message, centerIds: [] }
  const centerIds = (data ?? []).map((row: { id: string }) => row.id)
  if (centerIds.length === 0) return { ok: false, reason: "no scoped service center found", centerIds: [] }

  return { ok: true, centerIds }
}

async function processNotificationQueue(
  supabase: SupabaseClient,
  config: TwilioConfig,
  request: QueueWorkerRequest,
  actor: { userId: string | null; role: ProfileRole; isServiceRole: boolean },
) {
  const scope = await resolveQueueScope(supabase, actor.userId, actor.role, actor.isServiceRole, request.service_center_id)
  if (!scope.ok) return json({ error: scope.reason }, 403)

  const now = new Date().toISOString()
  const limit = Math.max(1, Math.min(Number(request.limit ?? 10), 25))
  let query = supabase
    .from("notification_queue")
    .select("id,service_center_id,customer_id,user_id,channel,recipient,body,status,entity_type,entity_id,metadata,delivery_attempts,scheduled_at")
    .eq("status", "pending")
    .eq("entity_type", "crm_service_due")
    .in("channel", ["whatsapp", "sms"])
    .order("created_at", { ascending: true })
    .limit(limit)

  if (request.queue_id) {
    query = query.eq("id", request.queue_id)
  } else {
    query = query.or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
  }

  if (scope.centerIds) query = query.in("service_center_id", scope.centerIds)

  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)

  const rows = (data ?? []) as NotificationQueueRow[]
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    const attempt = Number(row.delivery_attempts ?? 0) + 1
    const { data: claimed, error: claimError } = await supabase
      .from("notification_queue")
      .update({
        status: "queued",
        delivery_attempts: attempt,
        last_attempted_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id,service_center_id,customer_id,user_id,channel,recipient,body,status,entity_type,entity_id,metadata,delivery_attempts,scheduled_at")
      .maybeSingle()

    if (claimError || !claimed) {
      skipped += 1
      continue
    }

    const queueRow = claimed as NotificationQueueRow
    await upsertCommunicationLog(supabase, queueRow, { status: "queued" })

    const recipient = toE164(queueRow.recipient)
    if (!recipient || !isAllowedPhone(recipient)) {
      const message = "valid E.164 recipient is required"
      await supabase.from("notification_queue").update({
        status: "failed",
        provider: "twilio",
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq("id", queueRow.id)
      await upsertCommunicationLog(supabase, queueRow, { status: "failed", recipient: queueRow.recipient, error_message: message })
      failed += 1
      continue
    }

    const result = await sendViaTwilio(config, queueRow.channel as "sms" | "whatsapp", recipient, queueRow.body)
    await logTwilioApiResult(supabase, result)
    await insertSmsMessageLog(supabase, queueRow, recipient, result)

    const finalStatus = result.ok ? "sent" : "failed"
    const finishedAt = new Date().toISOString()
    await supabase.from("notification_queue").update({
      status: finalStatus,
      provider: "twilio",
      provider_message_id: result.data.sid ?? null,
      sent_at: result.ok ? finishedAt : null,
      error_message: result.ok ? null : result.data.error_message,
      updated_at: finishedAt,
    }).eq("id", queueRow.id)

    await upsertCommunicationLog(supabase, queueRow, {
      status: finalStatus,
      recipient,
      provider_message_id: result.data.sid ?? null,
      error_message: result.ok ? null : result.data.error_message,
    })

    if (result.ok) sent += 1
    else failed += 1
  }

  return json({
    success: true,
    processed: rows.length,
    sent,
    failed,
    skipped,
  })
}

async function isAuthorizedSender(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  profileRole: ProfileRole,
  request: { to: string; customer_id?: string; booking_id?: string; job_id?: string },
): Promise<{ ok: boolean; reason?: string; service_center_id?: string | null }> {
  if (profileRole === "admin") return { ok: true, service_center_id: null }

  let customerId = request.customer_id ?? null
  let serviceCenterId: string | null = null

  if (request.booking_id) {
    const { data: booking } = await supabase
      .from("customer_bookings")
      .select("customer_id, service_center_id")
      .eq("id", request.booking_id)
      .maybeSingle()
    if (booking) {
      if (customerId && booking.customer_id && customerId !== booking.customer_id) {
        return { ok: false, reason: "booking customer scope mismatch" }
      }
      customerId = customerId ?? booking.customer_id
      serviceCenterId = serviceCenterId ?? booking.service_center_id
    } else {
      const { data: serviceBooking } = await supabase
        .from("service_bookings")
        .select("user_id, service_center_id")
        .eq("id", request.booking_id)
        .maybeSingle()
      if (!serviceBooking) return { ok: false, reason: "booking not found" }
      if (customerId && serviceBooking.user_id && customerId !== serviceBooking.user_id) {
        return { ok: false, reason: "booking customer scope mismatch" }
      }
      customerId = customerId ?? serviceBooking.user_id
      serviceCenterId = serviceCenterId ?? serviceBooking.service_center_id
    }
  }

  if (request.job_id) {
    const { data: job } = await supabase
      .from("service_job_cards")
      .select("customer_id, service_center_id")
      .eq("id", request.job_id)
      .maybeSingle()
    if (!job) return { ok: false, reason: "job not found" }
    if (customerId && job.customer_id && customerId !== job.customer_id) {
      return { ok: false, reason: "job customer scope mismatch" }
    }
    customerId = customerId ?? job.customer_id
    serviceCenterId = serviceCenterId ?? job.service_center_id
  }

  if (!customerId) return { ok: false, reason: "customer, booking, or job scope required" }

  const { data: customer } = await supabase
    .from("profiles")
    .select("id, phone, whatsapp_number, preferred_center_id")
    .eq("id", customerId)
    .maybeSingle()
  if (!customer) return { ok: false, reason: "customer not found" }

  const requestedPhone = normalizePhone(request.to).slice(-10)
  const customerPhones = [customer.phone, customer.whatsapp_number]
    .filter(Boolean)
    .map((value) => normalizePhone(String(value)).slice(-10))
  if (requestedPhone && customerPhones.length && !customerPhones.includes(requestedPhone)) {
    return { ok: false, reason: "recipient does not match scoped customer" }
  }

  if (profileRole === "customer") {
    return customerId === userId
      ? { ok: true, service_center_id: serviceCenterId ?? customer.preferred_center_id ?? null }
      : { ok: false, reason: "customers can only message their own account scope" }
  }

  if (profileRole === "dealer") {
    const centerId = serviceCenterId ?? customer.preferred_center_id
    if (!centerId) return { ok: false, reason: "dealer-owned service center scope required" }
    const { data: center } = await supabase
      .from("service_centers")
      .select("id")
      .eq("id", centerId)
      .eq("owner_id", userId)
      .maybeSingle()
    return center
      ? { ok: true, service_center_id: centerId }
      : { ok: false, reason: "dealer cannot access this customer scope" }
  }

  return { ok: false, reason: "role not allowed to send messages" }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  const startTime = Date.now()
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const payload = await req.json()
    const queueRequest = isQueueWorkerRequest(payload)
    const authHeader = req.headers.get("Authorization") ?? ""
    const bearer = authHeader.replace(/^Bearer\s+/i, "")
    const isServiceRole = bearer !== "" && bearer === serviceKey

    let userId: string | null = null
    let profileRole: ProfileRole = isServiceRole ? "service_role" : "customer"

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userError } = await authClient.auth.getUser()
      if (userError || !userData.user) return json({ error: "authenticated user required" }, 401)

      userId = userData.user.id
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle()
      profileRole = (profile?.role ?? "customer") as ProfileRole
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
    const fromPhone = Deno.env.get("TWILIO_PHONE_NUMBER")
    const fromWA = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? `whatsapp:${fromPhone}`

    if (!accountSid || !authToken || !fromPhone) {
      return json({ error: "Twilio not configured", code: "NO_CONFIG" }, 503)
    }

    const twilioConfig: TwilioConfig = { accountSid, authToken, fromPhone, fromWA }

    if (queueRequest) {
      return processNotificationQueue(supabase, twilioConfig, payload, {
        userId,
        role: profileRole,
        isServiceRole,
      })
    }

    if (isServiceRole) return json({ error: "user authentication required for direct sends" }, 401)

    const body = payload as SendRequest
    const { to, channel = "sms", type, variables = {}, customer_id, booking_id, job_id } = body

    if (!to || !isAllowedPhone(to)) {
      return json({ error: "valid E.164 recipient is required" }, 400)
    }
    if (channel !== "sms" && channel !== "whatsapp") return json({ error: "unsupported channel" }, 400)
    if (!TEMPLATES[type]) return json({ error: "unsupported message type" }, 400)
    if (type === "otp" && profileRole !== "admin") return json({ error: "direct OTP sends are restricted" }, 403)
    if (body.body && body.body.length > 1000) return json({ error: "message body too long" }, 400)

    const authorized = await isAuthorizedSender(supabase, userId!, profileRole, {
      to,
      customer_id,
      booking_id,
      job_id,
    })
    if (!authorized.ok) return json({ error: authorized.reason }, 403)

    const template = TEMPLATES[type] ?? TEMPLATES.custom
    const messageBody = interpolate(template, { ...variables, body: body.body ?? "" })
    const bodyPreview = redactSensitivePreview(messageBody, type).slice(0, 100)
    const result = await sendViaTwilio(twilioConfig, channel, to, messageBody)

    EdgeRuntime.waitUntil(
      (async () => {
        await logTwilioApiResult(supabase, result)

        await supabase.from("sms_messages").insert({
          to_phone: to,
          message_type: type,
          body_preview: bodyPreview,
          twilio_sid: result.data.sid ?? null,
          status: result.data.status ?? (result.ok ? "queued" : "failed"),
          customer_id: customer_id ?? null,
          booking_id: booking_id ?? null,
          job_id: job_id ?? null,
          service_center_id: authorized.service_center_id ?? null,
          error_msg: result.ok ? null : result.data.error_message,
        })

        await supabase.from("communication_logs").insert({
          service_center_id: authorized.service_center_id ?? null,
          notification_queue_id: null,
          customer_id: customer_id ?? null,
          user_id: customer_id ?? null,
          channel,
          direction: "outbound",
          message_type: type,
          recipient: to,
          body_preview: bodyPreview,
          status: result.ok ? "sent" : "failed",
          provider: "twilio",
          provider_message_id: result.data.sid ?? null,
          error_message: result.ok ? null : result.data.error_message,
          entity_type: job_id ? "service_job_card" : booking_id ? "booking" : "customer",
          entity_id: job_id ?? booking_id ?? customer_id ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
          failed_at: result.ok ? null : new Date().toISOString(),
        })
      })(),
    )

    if (!result.ok) {
      return json({ error: "Twilio error", detail: result.data }, 502)
    }

    return json({ success: true, sid: result.data.sid, status: result.data.status, latency_ms: result.latency_ms })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    EdgeRuntime.waitUntil(
      supabase.from("api_logs").insert({
        provider: "twilio", endpoint: "/Messages.json",
        success: false, error_msg: msg, latency_ms: Date.now() - startTime,
      }),
    )
    return json({ error: msg }, 500)
  }
})
