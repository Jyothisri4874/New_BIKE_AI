import { useState, useRef, useEffect } from 'react'
import { X, Send, Mic, MicOff, Minimize2, Maximize2, Bot, User, Loader, Zap, Wrench, Users, ChartBar as BarChart2, ClipboardList, ShoppingBag, Volume2, VolumeX } from 'lucide-react'
import {
  api,
  clearChatBackupSession,
  getChatBackupIdentity,
  getChatBackupSessionKey,
  loadChatBackupHistory,
  saveChatBackupMessage,
  type ChatMessage,
  type AssistantRole,
} from '@/lib/api'
import { getCustomerCopy, speechLocaleForLanguage, type CustomerLanguage } from '../lib/customerLanguage'

// ── Role configuration ────────────────────────────────────────────────────────

export type { AssistantRole }

interface RoleConfig {
  label: string
  subtitle: string
  color: string        // header + user bubble
  accentBg: string     // icon / empty-state bg
  accentText: string   // empty-state title
  hint: string         // input placeholder
  Icon: React.ElementType
  quickActions: { label: string; prompt: string }[]
  greeting: string
}

export const ROLE_CONFIG: Record<AssistantRole, RoleConfig> = {
  customer: {
    label: 'BikeAI Assistant',
    subtitle: 'Service & Support',
    color: '#0f2044',
    accentBg: '#eef2f8',
    accentText: '#0f2044',
    hint: 'Book service, track repair, report issue…',
    Icon: Wrench,
    greeting: "Hi! I'm your BikeAI service assistant. How can I help you today?",
    quickActions: [
      { label: 'Book Service',        prompt: 'I want to book a service for my bike' },
      { label: 'Track My Repair',     prompt: 'What is the status of my repair?' },
      { label: 'Battery Dead',        prompt: 'My bike battery is dead, I need help' },
      { label: 'Find Nearby Center',  prompt: 'Find the nearest BikeAI service center' },
    ],
  },

  dealer: {
    label: 'Dealer Assistant',
    subtitle: 'Workshop Operations',
    color: '#0B1F4D',
    accentBg: 'rgba(255,214,0,0.1)',
    accentText: '#0B1F4D',
    hint: "Ask about bookings, technicians, queue…",
    Icon: ClipboardList,
    greeting: "Workshop assistant ready. What do you need?",
    quickActions: [
      { label: "Today's Bookings",    prompt: "Show me today's booking summary" },
      { label: 'Assign Technician',   prompt: 'How should I assign technicians for pending jobs?' },
      { label: 'Pickup Requests',     prompt: 'List all pending pickup and drop requests' },
      { label: 'Delayed Jobs',        prompt: 'Which jobs are delayed or overdue?' },
    ],
  },

  crm: {
    label: 'CRM Assistant',
    subtitle: 'Customer Engagement',
    color: '#059669',
    accentBg: '#f0fdf4',
    accentText: '#059669',
    hint: 'Reminders, campaigns, follow-ups…',
    Icon: Users,
    greeting: "CRM AI ready. Let's engage your customers.",
    quickActions: [
      { label: 'Service Reminders',   prompt: 'Draft a service reminder for customers due this week' },
      { label: 'Follow-up Pending',   prompt: 'Which customers have pending follow-ups?' },
      { label: 'Loyalty Campaign',    prompt: 'Create a loyalty campaign for repeat customers' },
      { label: 'Feedback Requests',   prompt: 'Draft a feedback request message for recent customers' },
    ],
  },

  service_manager: {
    label: 'Service Manager AI',
    subtitle: 'Workshop Floor Ops',
    color: '#b45309',
    accentBg: '#fffbeb',
    accentText: '#b45309',
    hint: 'Job cards, parts, QC, technicians…',
    Icon: ShoppingBag,
    greeting: "Service Manager AI ready. Floor status?",
    quickActions: [
      { label: 'Active Repairs',      prompt: 'Show all active repairs and their status' },
      { label: 'Pending Approvals',   prompt: 'Which job cards are pending QC approval?' },
      { label: 'Parts Shortage',      prompt: 'Are there any parts shortages or pending orders?' },
      { label: 'Ready for Delivery',  prompt: 'Which bikes are ready for customer delivery?' },
    ],
  },

  admin: {
    label: 'Executive Assistant',
    subtitle: 'Platform Intelligence',
    color: '#7c3aed',
    accentBg: '#f5f3ff',
    accentText: '#7c3aed',
    hint: 'Revenue, dealers, analytics, platform health…',
    Icon: BarChart2,
    greeting: "Executive AI ready. What would you like to analyse?",
    quickActions: [
      { label: 'Revenue Analytics',   prompt: 'Give me a revenue summary and key trends' },
      { label: 'Dealer Performance',  prompt: 'Which dealers are performing best and worst?' },
      { label: 'Active Cities',       prompt: 'Show coverage and activity by city' },
      { label: 'Platform Health',     prompt: 'What is the overall platform health status?' },
    ],
  },

  // ── Legacy mode aliases ────────────────────────────────────────────────────
  assistant: {
    label: 'BikeAI Assistant',
    subtitle: 'General Support',
    color: '#0f2044',
    accentBg: '#eef2f8',
    accentText: '#0f2044',
    hint: 'Ask about vehicles, services, workshops…',
    Icon: Bot,
    greeting: "Hi! How can I help you with BikeAI today?",
    quickActions: [
      { label: 'Tyre Pressure',         prompt: 'What is the correct tyre pressure for Honda Activa?' },
      { label: 'Service Interval',      prompt: 'What is the service interval for Hero Splendor?' },
      { label: 'Nearest Workshop',      prompt: 'Find the nearest Honda workshop' },
      { label: 'Oil Grade',             prompt: 'What engine oil grade should I use for TVS Apache?' },
    ],
  },
  executive: {
    label: 'Executive AI',
    subtitle: 'Business Intelligence',
    color: '#b45309',
    accentBg: '#fffbeb',
    accentText: '#b45309',
    hint: 'Revenue, performance, analytics…',
    Icon: BarChart2,
    greeting: "Executive AI ready. Ask me about performance and analytics.",
    quickActions: [
      { label: 'Revenue Down?',     prompt: 'Why is revenue down this month?' },
      { label: 'Branch Overloaded', prompt: 'Which branch is overloaded?' },
      { label: "Tomorrow's Load",   prompt: "Predict tomorrow's workshop load" },
    ],
  },
  search: {
    label: 'Vehicle Search',
    subtitle: 'Find Your Bike',
    color: '#2563eb',
    accentBg: '#eff6ff',
    accentText: '#2563eb',
    hint: 'Search vehicles, specs, compare…',
    Icon: Zap,
    greeting: "What are you looking for? I can help compare bikes and find the right service.",
    quickActions: [
      { label: 'Budget Commuter',   prompt: 'Best commuter bike under ₹80,000' },
      { label: 'EV Comparison',     prompt: 'Compare Ola S1 Pro vs Ather 450X' },
      { label: 'Premium Segment',   prompt: 'Best bikes in the ₹1.5–2L range' },
    ],
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface Props {
  role?: AssistantRole
  context?: string
  placeholder?: string
  title?: string
  language?: CustomerLanguage
  crmContext?: {
    customerId?: string
    serviceCenterId?: string
    jobCardId?: string
    bookingId?: string
    visibility?: 'customer' | 'internal'
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIChatWidget({ role = 'assistant', context, placeholder, title, language, crmContext }: Props) {
  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState(false)
  // Each role gets its own isolated message history key
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceReply, setVoiceReply] = useState(false)
  const [backupSessionId, setBackupSessionId] = useState<string | null>(null)

  const endRef    = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.assistant
  const { Icon } = cfg
  const customerCopy = getCustomerCopy(language)
  const speechLang = speechLocaleForLanguage(language)
  const voiceInputSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const voiceReplySupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const chatContext = [
    context,
    role === 'customer' ? `Customer preferred language: ${customerCopy.languageName}. ${customerCopy.replyLanguageInstruction}` : '',
  ].filter(Boolean).join('\n')
  const backupSource = crmContext?.serviceCenterId ? 'crm_service_chat' : 'ai_chat'
  const backupIdentity = getChatBackupIdentity(crmContext?.customerId)
  const backupSessionKey = getChatBackupSessionKey(backupSource, role, backupIdentity.identity)
  const backupLocation = crmContext ? {
    serviceCenterId: crmContext.serviceCenterId,
    jobCardId: crmContext.jobCardId,
    bookingId: crmContext.bookingId,
    visibility: crmContext.visibility,
  } : undefined

  useEffect(() => {
    let active = true
    setMessages([])
    setBackupSessionId(null)
    loadChatBackupHistory({
      source: backupSource,
      chatbotType: role,
      sessionKey: backupSessionKey,
      userId: backupIdentity.userId,
      customerId: backupIdentity.customerId,
      limit: 100,
    }).then(history => {
      if (!active) return
      setBackupSessionId(history.session?.id ?? null)
      if (history.messages.length) setMessages(history.messages.map(toWidgetMessage))
    }).catch(() => {})
    return () => { active = false }
  }, [backupSource, role, backupSessionKey, backupIdentity.userId, backupIdentity.customerId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message    = { id: Date.now().toString(), role: 'user', content: text.trim() }
    const assistantId         = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', streaming: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    const history: ChatMessage[] = [
      ...messages.slice(-12).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: text.trim() },
    ]

    try {
      const activeSessionId = await persistBackupMessage('user', text.trim())
      const response = await api.post<{ reply?: string; message?: string }>('/api/ai-chat', {
        messages: history,
        context: chatContext || undefined,
        role,
      })

      const assistantText = response?.reply || response?.message || 'No response received.'

      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: assistantText } : m)
      )

      speakAssistant(assistantText)

      await persistBackupMessage('assistant', assistantText, activeSessionId)
      await persistCrmChatMemory(text.trim(), assistantText, role, crmContext)
    } catch {
      const fallback = 'Sorry, I could not connect. Please try again.'
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: fallback }
          : m
        )
      )
      await persistBackupMessage('assistant', fallback)
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
      setLoading(false)
    }
  }

  async function persistBackupMessage(sender: 'user' | 'assistant', message: string, sessionId = backupSessionId) {
    const saved = await saveChatBackupMessage({
      sessionId,
      sessionKey: backupSessionKey,
      source: backupSource,
      chatbotType: role,
      sender,
      message,
      userId: backupIdentity.userId,
      customerId: backupIdentity.customerId,
      location: backupLocation,
    }).catch(() => null)
    if (saved?.session?.id) setBackupSessionId(saved.session.id)
    return saved?.session?.id || sessionId || undefined
  }

  function clearChatHistory() {
    const sessionId = backupSessionId
    setMessages([])
    setBackupSessionId(null)
    if (sessionId) void clearChatBackupSession(sessionId).catch(() => {})
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  function speakAssistant(text: string) {
    if (!voiceReply || !voiceReplySupported || !text.trim()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1200))
    utterance.lang = speechLang
    window.speechSynthesis.speak(utterance)
  }

  function toggleVoiceReply() {
    const next = !voiceReply
    setVoiceReply(next)
    if (!next && voiceReplySupported) window.speechSynthesis.cancel()
  }

  function closeWidget() {
    if (voiceReplySupported) window.speechSynthesis.cancel()
    setOpen(false)
  }

  function startVoice() {
    const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    type SR = { lang: string; onresult: ((e: SpeechRecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void }
    const SRCtor = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SR) | undefined
    if (!SRCtor || loading) return
    const recognition = new SRCtor()
    recognition.lang = speechLang
    setListening(true)
    recognition.onresult = (e: SpeechRecognitionEvent) => { setInput(e.results[0]?.[0]?.transcript ?? ''); setListening(false) }
    recognition.onerror  = () => setListening(false)
    recognition.onend    = () => setListening(false)
    recognition.start()
  }

  const widgetW = expanded ? '520px' : '380px'
  const widgetH = expanded ? '600px' : '480px'

  // ── FAB (closed state) ────────────────────────────────────────────────────
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...s.fab, background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }} title={cfg.label}>
        <Icon size={22} color="white" />
        <span style={s.fabBadge} />
      </button>
    )
  }

  // ── Widget (open state) ───────────────────────────────────────────────────
  return (
    <div style={{ ...s.widget, width: widgetW, height: widgetH }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .ai-qa:hover { background: ${cfg.accentBg} !important; border-color: ${cfg.color}55 !important; }
        .ai-send:not(:disabled):hover { filter: brightness(1.1); }
      `}</style>

      {/* Header */}
      <div style={{ ...s.header, background: cfg.color }}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}><Icon size={16} color="white" /></div>
          <div>
            <span style={s.headerTitle}>{title ?? cfg.label}</span>
            <span style={s.headerSub}><span style={s.dot} /> {cfg.subtitle}</span>
          </div>
        </div>
        <div style={s.headerActions}>
          {role === 'customer' && voiceReplySupported && (
            <button style={s.iconBtn} onClick={toggleVoiceReply} title={voiceReply ? customerCopy.voiceReplyOn : customerCopy.voiceReplyOff}>
              {voiceReply ? <Volume2 size={13} color="rgba(255,255,255,0.85)" /> : <VolumeX size={13} color="rgba(255,255,255,0.6)" />}
            </button>
          )}
          {messages.length > 0 && (
            <button style={s.iconBtn} onClick={clearChatHistory} title="Clear chat">
              <X size={11} color="rgba(255,255,255,0.5)" />
            </button>
          )}
          <button style={s.iconBtn} onClick={() => setExpanded(e => !e)} title={expanded ? 'Minimize' : 'Expand'}>
            {expanded ? <Minimize2 size={13} color="rgba(255,255,255,0.7)" /> : <Maximize2 size={13} color="rgba(255,255,255,0.7)" />}
          </button>
          <button style={s.iconBtn} onClick={closeWidget} title="Close">
            <X size={13} color="rgba(255,255,255,0.7)" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div style={s.messages}>
        {messages.length === 0 && (
          <EmptyState cfg={cfg} onQuick={sendMessage} />
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ ...s.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ ...s.avatar, background: cfg.accentBg, color: cfg.color }}><Icon size={12} /></div>
            )}
            <div style={{
              ...s.bubble,
              background:   msg.role === 'user' ? cfg.color : '#f8f9fc',
              color:        msg.role === 'user' ? 'white' : '#1f2937',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              maxWidth:     expanded ? '78%' : '82%',
            }}>
              {msg.streaming && msg.content === '' ? (
                <div style={s.typing}><span /><span /><span /></div>
              ) : (
                <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.55' }}>{msg.content}</span>
              )}
              {msg.streaming && msg.content !== '' && (
                <span style={s.cursor}>|</span>
              )}
            </div>
            {msg.role === 'user' && (
              <div style={{ ...s.avatar, background: cfg.color + '22', color: cfg.color }}><User size={12} /></div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick action bar — shown after first message */}
      {messages.length > 0 && !loading && (
        <div style={s.quickBar}>
          {cfg.quickActions.slice(0, 2).map(qa => (
            <button key={qa.label} onClick={() => sendMessage(qa.prompt)}
              style={{ ...s.quickChipSmall, borderColor: cfg.color + '40', color: cfg.color }}
              className="ai-qa">
              <Zap size={9} /> {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={s.inputArea}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? customerCopy.listening : (placeholder ?? (role === 'customer' ? customerCopy.chatPlaceholder : cfg.hint))}
          disabled={loading}
          style={{ ...s.input, opacity: loading ? 0.6 : 1 }}
        />
        <button onClick={startVoice} disabled={loading || !voiceInputSupported}
          style={{ ...s.sendBtn, background: listening ? '#dc2626' : '#f1f3f8', cursor: voiceInputSupported && !loading ? 'pointer' : 'not-allowed' }}
          title={voiceInputSupported ? customerCopy.voiceInput : customerCopy.voiceUnavailable}>
          {listening ? <MicOff size={15} color="white" /> : <Mic size={15} color={voiceInputSupported ? '#6b7280' : '#cbd5e1'} />}
        </button>
        <button onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{ ...s.sendBtn, background: input.trim() && !loading ? cfg.color : '#e5e7eb' }}
          className="ai-send" title="Send">
          {loading
            ? <Loader size={15} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={15} color={input.trim() && !loading ? 'white' : '#9ca3af'} />
          }
        </button>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ cfg, onQuick }: { cfg: RoleConfig; onQuick: (p: string) => void }) {
  const { Icon } = cfg
  return (
    <div style={s.emptyState}>
      <div style={{ ...s.emptyIcon, background: cfg.accentBg, color: cfg.color }}>
        <Icon size={26} />
      </div>
      <p style={{ ...s.emptyTitle, color: cfg.accentText }}>{cfg.label}</p>
      <p style={s.emptyGreeting}>{cfg.greeting}</p>
      <div style={s.quickGrid}>
        {cfg.quickActions.map(qa => (
          <button key={qa.label}
            onClick={() => onQuick(qa.prompt)}
            style={{ ...s.quickChip, borderColor: cfg.color + '35', color: cfg.color }}
            className="ai-qa">
            {qa.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Inline panel variant (embed anywhere without FAB) ─────────────────────────

export function AIChatPanel({ role = 'assistant', context, placeholder, title, language, crmContext }: Props) {
  return (
    <div style={{ position: 'relative', height: '100%', minHeight: '480px' }}>
      <AIChatWidget role={role} context={context} placeholder={placeholder} title={title} language={language} crmContext={crmContext} />
    </div>
  )
}

function toWidgetMessage(message: { id: string; sender: string; message: string }): Message {
  return {
    id: message.id,
    role: message.sender === 'user' ? 'user' : 'assistant',
    content: message.message,
  }
}

async function persistCrmChatMemory(userText: string, assistantText: string, role: AssistantRole, crmContext?: Props['crmContext']) {
  if (!crmContext?.customerId || !crmContext.serviceCenterId) return
  const combined = `${userText}\n${assistantText}`
  const tags = detectRiskTags(combined)
  const visibility = crmContext.visibility || (role === 'customer' ? 'customer' : 'internal')
  // TODO: Confirm backend endpoints for persisting chat memory + CRM events + job risk escalation.
  await api.post('/api/crm/chat-memory', {
    job_card_id: crmContext.jobCardId || null,
    customer_id: crmContext.customerId,
    service_center_id: crmContext.serviceCenterId,
    conversation_source: 'chatbot',
    visibility,
    tags,
    summary: userText.slice(0, 220),
    raw_excerpt: combined.slice(0, 1200),
    sentiment: tags.some(t => ['complaint', 'delay_frustration', 'retention_risk', 'urgent_support'].includes(t)) ? 'risk' : 'neutral',
  }).catch(() => {})

  await api.post('/api/crm/interaction-events', {
    customer_id: crmContext.customerId,
    service_center_id: crmContext.serviceCenterId,
    event_type: tags.length ? 'chatbot_risk_detected' : 'chatbot_conversation',
    title: tags.length ? 'Chatbot risk tags detected' : 'Chatbot conversation stored',
    body: combined.slice(0, 900),
    entity_type: 'service_chat_memory',
    entity_id: crmContext.jobCardId || crmContext.bookingId || null,
  }).catch(() => {})
  if (crmContext.jobCardId && tags.some(t => ['delay_frustration', 'breakdown_risk', 'retention_risk', 'escalation_required', 'unhappy_customer', 'urgent_support'].includes(t))) {
    await api.patch(`/api/job-cards/${encodeURIComponent(crmContext.jobCardId)}`, {
      operational_risk_state: 'escalated',
      risk_tags: tags,
      updated_at: new Date().toISOString(),
    }).catch(() => {})
  }
}

function detectRiskTags(text: string) {
  const lower = text.toLowerCase()
  const tags: string[] = []
  if (/(complaint|bad service|poor service|not happy|unhappy)/.test(lower)) tags.push('complaint', 'unhappy_customer')
  if (/(delay|late|waiting|too long)/.test(lower)) tags.push('delay_frustration')
  if (/(again|repeat|same issue|recurring)/.test(lower)) tags.push('repeat_issue')
  if (/(breakdown|stuck|not starting|dead battery|accident)/.test(lower)) tags.push('breakdown_risk', 'urgent_support')
  if (/(another workshop|elsewhere|too costly|high cost|far away|sold)/.test(lower)) tags.push('retention_risk')
  if (/(manager|escalate|urgent|immediately)/.test(lower)) tags.push('escalation_required')
  return [...new Set(tags)]
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', bottom: '28px', right: '28px', zIndex: 200,
    width: '56px', height: '56px', borderRadius: '50%',
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'transform 0.18s, box-shadow 0.18s',
  },
  fabBadge: {
    position: 'absolute', top: '10px', right: '10px',
    width: '10px', height: '10px', borderRadius: '50%',
    background: '#f5e019', border: '2px solid white',
  },
  widget: {
    position: 'fixed', bottom: '28px', right: '28px', zIndex: 200,
    background: 'white', borderRadius: '20px', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column',
    transition: 'width 0.2s, height 0.2s',
    border: '1px solid rgba(0,0,0,0.07)',
  },
  header: {
    padding: '14px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexShrink: 0,
  },
  headerLeft:    { display: 'flex', alignItems: 'center', gap: '10px' },
  headerIcon:    { width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle:   { fontSize: '14px', fontWeight: '700', color: 'white', display: 'block' },
  headerSub:     { fontSize: '11px', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: '4px' },
  dot:           { width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' },
  headerActions: { display: 'flex', gap: '4px' },
  iconBtn:       { width: '26px', height: '26px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.12s' },

  messages:     { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  emptyState:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 12px', textAlign: 'center' },
  emptyIcon:    { width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' },
  emptyTitle:   { fontSize: '15px', fontWeight: '700', margin: 0 },
  emptyGreeting:{ fontSize: '12.5px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 4px', maxWidth: '260px' },
  quickGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', marginTop: '4px' },
  quickChip:    { padding: '7px 8px', borderRadius: '10px', fontSize: '11.5px', fontWeight: '600', background: 'white', border: '1.5px solid', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s', lineHeight: '1.3' },

  quickBar:       { padding: '4px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  quickChipSmall: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: 'white', border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' },

  msgRow:  { display: 'flex', alignItems: 'flex-end', gap: '6px' },
  avatar:  { width: '26px', height: '26px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:  { padding: '10px 14px', fontSize: '13.5px', wordBreak: 'break-word', lineHeight: '1.55' },
  typing:  { display: 'flex', gap: '4px', padding: '4px 0', alignItems: 'center' },
  cursor:  { animation: 'blink 1s step-end infinite', fontSize: '14px', color: '#9ca3af', marginLeft: '2px' },

  inputArea: { padding: '10px 12px', display: 'flex', gap: '6px', alignItems: 'center', borderTop: '1px solid #f3f4f6', flexShrink: 0 },
  input:     { flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#111827' },
  sendBtn:   { width: '36px', height: '36px', borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' },
}
