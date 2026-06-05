import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, MapPin, ChevronRight, CircleCheck as CheckCircle, MessageCircle, RotateCcw } from 'lucide-react'

// ── Booking flow data ─────────────────────────────────────────────────────────

const BRANDS = ['Honda', 'Hero', 'TVS', 'Bajaj', 'Royal Enfield', 'Yamaha', 'Suzuki', 'KTM']

const MODELS: Record<string, string[]> = {
  Honda:         ['Activa 6G', 'CB Shine', 'SP125', 'Unicorn', 'Hornet 2.0', 'CB300R'],
  Hero:          ['Splendor+', 'HF Deluxe', 'Passion Pro', 'Glamour', 'Xpulse 200', 'Destini 125'],
  TVS:           ['Jupiter', 'Ntorq 125', 'Apache RTR 160', 'Apache RR 310', 'Raider 125', 'iQube'],
  Bajaj:         ['Pulsar NS200', 'Pulsar 150', 'Platina 110', 'CT 110', 'Avenger 160', 'Dominar 400'],
  'Royal Enfield':['Classic 350', 'Meteor 350', 'Bullet 350', 'Himalayan', 'Hunter 350', 'Thunderbird 350'],
  Yamaha:        ['FZ-S V3', 'MT-15', 'R15 V4', 'Fascino 125', 'RayZR', 'Aerox 155'],
  Suzuki:        ['Access 125', 'Burgman Street', 'Gixxer 150', 'Gixxer SF 250', 'Avenis 125'],
  KTM:           ['Duke 200', 'Duke 390', 'RC 200', 'RC 390', 'Adventure 390'],
}

const SERVICES = [
  { label: 'General Service', icon: '🔧', desc: 'Oil change, filters, basics' },
  { label: 'Breakdown / RSA', icon: '🚨', desc: 'Stuck? We come to you' },
  { label: 'Pickup & Drop', icon: '🚚', desc: 'We collect & return your bike' },
  { label: 'Tyre Replacement', icon: '⚫', desc: 'Flat, worn or puncture' },
  { label: 'Battery Service', icon: '⚡', desc: 'Check, charge or replace' },
  { label: 'Brakes & Suspension', icon: '🛞', desc: 'Pads, discs, fork oil' },
  { label: 'Electrical / Wiring', icon: '💡', desc: 'Lights, horn, self-start' },
  { label: 'Full Inspection', icon: '🔍', desc: '45-point pre/post check' },
]

const NEARBY_DEALERS = [
  { name: 'SpeedFix Auto Works', area: 'Koramangala, Bengaluru', rating: '4.8', eta: '2 km · Free Pickup', slots: '11:00 AM, 2:00 PM' },
  { name: 'Moto Care Center', area: 'HSR Layout, Bengaluru', rating: '4.6', eta: '3.4 km · Free Pickup', slots: '10:30 AM, 3:00 PM' },
  { name: 'TwoWheel Experts', area: 'BTM Layout, Bengaluru', rating: '4.7', eta: '4.1 km · Free Pickup', slots: '9:00 AM, 1:00 PM' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowStep = 'idle' | 'brand' | 'model' | 'service' | 'location' | 'dealers' | 'confirmed'

interface Message {
  from: 'bot' | 'user'
  text: string
  component?: React.ReactNode
}

interface BookingState {
  brand: string
  model: string
  service: string
  location: string
  dealer: string
  slot: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingChatWidget() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<FlowStep>('idle')
  const [booking, setBooking] = useState<BookingState>({ brand: '', model: '', service: '', location: '', dealer: '', slot: '' })
  const [messages, setMessages] = useState<Message[]>([
    { from: 'bot', text: 'Hi! I\'m BikeAI — your smart service assistant.' },
    { from: 'bot', text: 'I can book a service, help in a breakdown, or track your repair. What do you need?' },
  ])
  const [locationInput, setLocationInput] = useState('')
  const [freeInput, setFreeInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addBot = (text: string, component?: React.ReactNode) => {
    setMessages(prev => [...prev, { from: 'bot', text, component }])
  }

  const addUser = (text: string) => {
    setMessages(prev => [...prev, { from: 'user', text }])
  }

  const handleChip = (label: string) => {
    if (label === 'Book Service') {
      addUser('Book Service')
      setTimeout(() => {
        addBot('Great! Let\'s set up your booking in a few quick steps.')
        setTimeout(() => {
          addBot('Which brand is your bike?')
          setStep('brand')
        }, 400)
      }, 200)
      return
    }
    if (label === 'Breakdown Help') {
      addUser('Breakdown Help')
      setTimeout(() => {
        addBot('RSA is active 24/7 across 50+ cities. Share your location and a technician will reach you in ~15 min.')
        addBot('Tap "Share Location" below or send your area name.')
        setStep('location')
        setBooking(prev => ({ ...prev, service: 'Breakdown / RSA' }))
      }, 200)
      return
    }
    if (label === 'Track Booking') {
      addUser('Track Booking')
      setTimeout(() => {
        addBot('To track your booking, please sign in at bikeai.in/my/bookings — all live updates are there.')
      }, 200)
      return
    }
    if (label === 'Talk to Expert') {
      addUser('Talk to Expert')
      setTimeout(() => {
        addBot('Connecting you to a human expert via WhatsApp...')
      }, 200)
      return
    }
  }

  const selectBrand = (brand: string) => {
    addUser(brand)
    setBooking(prev => ({ ...prev, brand }))
    setStep('model')
    setTimeout(() => {
      addBot(`Which ${brand} model do you have?`)
    }, 300)
  }

  const selectModel = (model: string) => {
    addUser(model)
    setBooking(prev => ({ ...prev, model }))
    setStep('service')
    setTimeout(() => {
      addBot(`Got it — ${booking.brand} ${model}. What service do you need?`)
    }, 300)
  }

  const selectService = (label: string) => {
    addUser(label)
    setBooking(prev => ({ ...prev, service: label }))
    setStep('location')
    setTimeout(() => {
      addBot('Perfect. Where should we pick up your bike?')
      addBot('Type your area or use "Detect My Location".')
    }, 300)
  }

  const submitLocation = (loc: string) => {
    if (!loc.trim()) return
    addUser(loc)
    setBooking(prev => ({ ...prev, location: loc }))
    setLocationInput('')
    setStep('dealers')
    setTimeout(() => {
      addBot(`Found 3 verified service centers near ${loc}. Choose one:`)
    }, 500)
  }

  const selectDealer = (dealer: typeof NEARBY_DEALERS[0], slot: string) => {
    addUser(`${dealer.name} · ${slot}`)
    setBooking(prev => ({ ...prev, dealer: dealer.name, slot }))
    setStep('confirmed')
    setTimeout(() => {
      addBot(`Booking confirmed! Here\'s your summary:`)
      addBot(
        `Bike: ${booking.brand} ${booking.model}\nService: ${booking.service}\nCenter: ${dealer.name}\nPickup: ${slot}\nLocation: ${booking.location}`
      )
      addBot('You\'ll receive an SMS confirmation shortly. Our rider will arrive 15 min before your slot.')
    }, 400)
  }

  const resetFlow = () => {
    setStep('idle')
    setBooking({ brand: '', model: '', service: '', location: '', dealer: '', slot: '' })
    setMessages([
      { from: 'bot', text: 'Hi! I\'m BikeAI — your smart service assistant.' },
      { from: 'bot', text: 'I can book a service, help in a breakdown, or track your repair. What do you need?' },
    ])
    setLocationInput('')
    setFreeInput('')
  }

  const sendFree = () => {
    if (!freeInput.trim()) return
    const msg = freeInput.trim()
    setFreeInput('')
    addUser(msg)
    const lower = msg.toLowerCase()
    setTimeout(() => {
      if (lower.includes('book') || lower.includes('service') || lower.includes('repair')) {
        addBot('Sure! Let me start the booking flow for you.')
        setTimeout(() => {
          addBot('Which brand is your bike?')
          setStep('brand')
        }, 350)
      } else if (lower.includes('track') || lower.includes('status')) {
        addBot('Head to bikeai.in/my/bookings to track all your active and past bookings in real time.')
      } else if (lower.includes('price') || lower.includes('cost') || lower.includes('rate')) {
        addBot('Service prices vary by bike model and service type. General service starts from ₹499. Select a service center to see exact pricing.')
      } else if (lower.includes('break') || lower.includes('stuck') || lower.includes('road')) {
        addBot('Breakdown? Our RSA team is 24/7. Tell me your location and we\'ll dispatch a technician immediately.')
        setStep('location')
        setBooking(prev => ({ ...prev, service: 'Breakdown / RSA' }))
      } else {
        addBot('I can help with service bookings, breakdown assistance, pricing, and tracking. What would you like to do?')
      }
    }, 300)
  }

  // ── Render chips per step ──────────────────────────────────────────────────

  const renderStepUI = () => {
    if (step === 'idle') {
      return (
        <div style={w.chips}>
          {['Book Service', 'Breakdown Help', 'Track Booking', 'Talk to Expert'].map(c => (
            <button key={c} style={w.chip} className="bwc-chip" onClick={() => handleChip(c)}>{c}</button>
          ))}
        </div>
      )
    }
    if (step === 'brand') {
      return (
        <div style={w.chips}>
          {BRANDS.map(b => (
            <button key={b} style={w.chip} className="bwc-chip" onClick={() => selectBrand(b)}>{b}</button>
          ))}
        </div>
      )
    }
    if (step === 'model') {
      const models = MODELS[booking.brand] || []
      return (
        <div style={w.chips}>
          {models.map(m => (
            <button key={m} style={w.chip} className="bwc-chip" onClick={() => selectModel(m)}>{m}</button>
          ))}
        </div>
      )
    }
    if (step === 'service') {
      return (
        <div style={w.serviceGrid}>
          {SERVICES.map(s => (
            <button key={s.label} style={w.serviceCard} className="bwc-svc" onClick={() => selectService(s.label)}>
              <span style={w.serviceIcon}>{s.icon}</span>
              <div>
                <div style={w.serviceLabel}>{s.label}</div>
                <div style={w.serviceDesc}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )
    }
    if (step === 'location') {
      return (
        <div style={w.locationRow}>
          <input
            style={w.locInput}
            placeholder="Enter your area (e.g. Koramangala)"
            value={locationInput}
            onChange={e => setLocationInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitLocation(locationInput)}
            autoFocus
          />
          <button style={w.locDetect} className="bwc-chip" onClick={() => submitLocation('Current Location')}>
            <MapPin size={12} /> Detect
          </button>
          <button
            style={{ ...w.locSend, opacity: locationInput.trim() ? 1 : 0.4 }}
            onClick={() => submitLocation(locationInput)}
            disabled={!locationInput.trim()}
          >
            <ChevronRight size={14} color="white" />
          </button>
        </div>
      )
    }
    if (step === 'dealers') {
      return (
        <div style={w.dealerList}>
          {NEARBY_DEALERS.map(d => (
            <div key={d.name} style={w.dealerCard} className="bwc-dealer">
              <div style={w.dealerTop}>
                <div>
                  <div style={w.dealerName}>{d.name}</div>
                  <div style={w.dealerMeta}><MapPin size={10} /> {d.area}</div>
                  <div style={w.dealerEta}>{d.eta}</div>
                </div>
                <div style={w.dealerRating}>⭐ {d.rating}</div>
              </div>
              <div style={w.slotRow}>
                {d.slots.split(', ').map(slot => (
                  <button key={slot} style={w.slotBtn} className="bwc-chip" onClick={() => selectDealer(d, slot)}>
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (step === 'confirmed') {
      return (
        <div style={w.confirmedActions}>
          <a href="/my/bookings" style={w.trackBtn}><CheckCircle size={13} /> Track Booking</a>
          <button style={w.resetBtn} onClick={resetFlow}><RotateCcw size={12} /> New Booking</button>
          <a href="https://wa.me/911800000000" target="_blank" rel="noreferrer" style={w.waBtn}><MessageCircle size={12} /> WhatsApp</a>
        </div>
      )
    }
    return null
  }

  return (
    <>
      <style>{`
        .bwc-chip:hover { background: rgba(255,214,0,0.2) !important; border-color: rgba(255,214,0,0.5) !important; }
        .bwc-svc:hover { border-color: rgba(255,214,0,0.4) !important; background: rgba(255,214,0,0.06) !important; }
        .bwc-dealer:hover { border-color: rgba(255,214,0,0.35) !important; }
        .bwc-fab:hover { transform: scale(1.04) !important; box-shadow: 0 8px 28px rgba(11,31,77,0.45) !important; }
        .bwc-loc:focus { border-color: rgba(255,214,0,0.5) !important; outline: none !important; }
        @media (max-width: 900px) {
          .bwc-drawer { bottom: 70px !important; right: 16px !important; width: calc(100vw - 32px) !important; }
          .bwc-fab-el { bottom: 78px !important; right: 16px !important; }
        }
        @keyframes bwcIn { from{opacity:0;transform:translateY(14px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes bwcFab { 0%{transform:scale(0.7)} 70%{transform:scale(1.05)} 100%{transform:scale(1)} }
      `}</style>

      {/* Drawer */}
      {open && (
        <div style={w.drawer} className="bwc-drawer">
          {/* Header */}
          <div style={w.header}>
            <div style={w.headerAvatar}><Bot size={15} color="#FFD600" /></div>
            <div style={{ flex: 1 }}>
              <div style={w.headerName}>BikeAI Assistant</div>
              <div style={w.headerStatus}><span style={w.dot} />Smart Booking · Always On</div>
            </div>
            {step !== 'idle' && step !== 'confirmed' && (
              <button style={w.resetHeaderBtn} onClick={resetFlow} title="Start over"><RotateCcw size={13} color="rgba(255,255,255,0.4)" /></button>
            )}
            <button style={w.closeBtn} onClick={() => setOpen(false)}><X size={15} color="rgba(255,255,255,0.5)" /></button>
          </div>

          {/* Messages */}
          <div style={w.body}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={m.from === 'bot' ? w.botBubble : w.userBubble} >
                  {m.text.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < m.text.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}

            {/* Step UI inline after last bot message */}
            {renderStepUI()}

            <div ref={endRef} />
          </div>

          {/* Free-text input (shown when in idle or after confirmed) */}
          {(step === 'idle' || step === 'confirmed') && (
            <div style={w.inputRow}>
              <input
                style={w.textInput}
                className="bwc-loc"
                placeholder="Ask anything about your bike…"
                value={freeInput}
                onChange={e => setFreeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendFree()}
              />
              <button style={{ ...w.sendBtn, opacity: freeInput.trim() ? 1 : 0.4 }} onClick={sendFree} disabled={!freeInput.trim()}>
                <Send size={13} color="white" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        style={{ ...w.fab, ...(open ? w.fabOpen : {}) }}
        className="bwc-fab-el bwc-fab"
        onClick={() => setOpen(v => !v)}
      >
        {open
          ? <X size={19} color="white" />
          : <><Bot size={19} color="white" /><span style={w.fabLabel}>Ask BikeAI</span></>
        }
      </button>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const w: Record<string, React.CSSProperties> = {
  fab: { position: 'fixed', bottom: '88px', right: '24px', background: 'linear-gradient(135deg,#0B1F4D,#1a3a6e)', color: 'white', borderRadius: '50px', padding: '11px 17px 11px 13px', display: 'flex', alignItems: 'center', gap: '7px', border: '1.5px solid rgba(255,214,0,0.35)', boxShadow: '0 6px 20px rgba(11,31,77,0.4)', cursor: 'pointer', zIndex: 350, fontFamily: 'inherit', transition: 'all 0.2s', animation: 'bwcFab 0.35s ease' },
  fabOpen: { background: '#132B63', borderColor: 'rgba(255,214,0,0.55)' },
  fabLabel: { fontSize: '13px', fontWeight: '700', color: 'white' },

  drawer: { position: 'fixed', bottom: '158px', right: '24px', width: '340px', background: '#0d1e42', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 56px rgba(0,0,0,0.5)', zIndex: 340, display: 'flex', flexDirection: 'column', animation: 'bwcIn 0.22s ease', maxHeight: '520px' },

  header: { background: '#132B63', padding: '12px 13px', display: 'flex', alignItems: 'center', gap: '9px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 },
  headerAvatar: { width: '31px', height: '31px', borderRadius: '50%', background: 'rgba(255,214,0,0.13)', border: '1.5px solid rgba(255,214,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerName: { fontSize: '13px', fontWeight: '700', color: 'white', lineHeight: 1.2 },
  headerStatus: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' },
  dot: { width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' },
  resetHeaderBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '5px' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '5px' },

  body: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '7px' },
  botBubble: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px 10px 10px 3px', padding: '8px 11px', fontSize: '13px', color: 'rgba(255,255,255,0.82)', lineHeight: '1.55', maxWidth: '87%' },
  userBubble: { background: '#FFD600', color: '#0B1F4D', borderRadius: '10px 10px 3px 10px', padding: '8px 11px', fontSize: '13px', fontWeight: '600', lineHeight: '1.55', maxWidth: '78%' },

  chips: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' },
  chip: { padding: '5px 11px', background: 'rgba(255,214,0,0.09)', border: '1px solid rgba(255,214,0,0.22)', borderRadius: '20px', fontSize: '11.5px', fontWeight: '600', color: '#FFD600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },

  serviceGrid: { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' },
  serviceCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s', width: '100%' },
  serviceIcon: { fontSize: '18px', flexShrink: 0 },
  serviceLabel: { fontSize: '12.5px', fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  serviceDesc: { fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '1px' },

  locationRow: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' },
  locInput: { flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '8px 10px', fontSize: '12.5px', color: 'white', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  locDetect: { display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 10px', background: 'rgba(255,214,0,0.09)', border: '1px solid rgba(255,214,0,0.22)', borderRadius: '9px', fontSize: '11px', fontWeight: '600', color: '#FFD600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  locSend: { width: '32px', height: '32px', borderRadius: '9px', background: '#FFD600', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' },

  dealerList: { display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '4px' },
  dealerCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '11px', padding: '10px', transition: 'border-color 0.15s' },
  dealerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  dealerName: { fontSize: '12.5px', fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: '3px' },
  dealerMeta: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'rgba(255,255,255,0.38)' },
  dealerEta: { fontSize: '10.5px', color: '#22C55E', marginTop: '2px', fontWeight: '600' },
  dealerRating: { fontSize: '11.5px', fontWeight: '700', color: '#FFD600' },
  slotRow: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  slotBtn: { padding: '4px 10px', background: 'rgba(255,214,0,0.09)', border: '1px solid rgba(255,214,0,0.22)', borderRadius: '20px', fontSize: '11px', fontWeight: '600', color: '#FFD600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },

  confirmedActions: { display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' },
  trackBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '20px', fontSize: '11.5px', fontWeight: '600', color: '#4ade80', textDecoration: 'none' },
  resetBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', fontSize: '11.5px', fontWeight: '600', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontFamily: 'inherit' },
  waBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: '20px', fontSize: '11.5px', fontWeight: '600', color: '#4ade80', textDecoration: 'none' },

  inputRow: { padding: '9px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '6px', flexShrink: 0 },
  textInput: { flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', padding: '7px 10px', fontSize: '12.5px', color: 'white', fontFamily: 'inherit' },
  sendBtn: { width: '32px', height: '32px', borderRadius: '9px', background: '#FFD600', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' },
}
