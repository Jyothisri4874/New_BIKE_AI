import { useState } from 'react'
import { Bot, MessageSquare, Mail, ChevronDown, ChevronUp, Circle as HelpCircle, Zap } from 'lucide-react'

const FAQS = [
  { q: 'How do I book a service?', a: "Go to 'Book Service' from the dashboard or navigation. Select your vehicle, service type, workshop, date, and confirm. You will receive a confirmation." },
  { q: 'Can I get free pickup and drop?', a: 'Yes! Free doorstep pickup is available for services worth Rs.500 or more. Enable this option during the booking flow.' },
  { q: 'How do I track my service?', a: "Once your booking is confirmed, go to Bookings and open the booking. You will see a live timeline showing each stage of service." },
  { q: 'What if I need to cancel a booking?', a: 'Open the booking, scroll down, and click Cancel Booking. Cancellations are free if done 2+ hours before the scheduled time.' },
  { q: 'How do I add multiple vehicles?', a: "Go to 'My Garage' and click 'Add Vehicle'. You can add any number of two-wheelers and manage them all from one place." },
  { q: 'How do I update my documents?', a: "Go to My Garage, open a vehicle, and click 'Documents'. You can upload RC, insurance, PUC, and warranty documents there." },
]

export default function CustomerSupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>Help & Support</h1>
        <p style={s.sub}>We're here to help you 24/7</p>
      </div>

      {/* Contact options */}
      <div style={s.contactGrid}>
        <div style={{ ...s.contactCard, cursor: 'default' }}>
          <div style={{ ...s.contactIcon, background: '#fefce8' }}><Bot size={22} color="#b08800" /></div>
          <div>
            <p style={s.contactTitle}>AI Assistant</p>
            <p style={s.contactSub}>Instant answers</p>
            <p style={s.contactHint}>Available 24/7 · No wait</p>
          </div>
        </div>
        <a href="https://wa.me/911234567890" target="_blank" rel="noreferrer" style={s.contactCard}>
          <div style={{ ...s.contactIcon, background: '#f0fdf4' }}><MessageSquare size={22} color="#16a34a" /></div>
          <div>
            <p style={s.contactTitle}>WhatsApp</p>
            <p style={s.contactSub}>Chat with us</p>
            <p style={s.contactHint}>Reply within 1 hour</p>
          </div>
        </a>
        <a href="mailto:support@bikeai.in" style={s.contactCard}>
          <div style={{ ...s.contactIcon, background: '#fffbeb' }}><Mail size={22} color="#f5a623" /></div>
          <div>
            <p style={s.contactTitle}>Email</p>
            <p style={s.contactSub}>support@bikeai.in</p>
            <p style={s.contactHint}>Reply within 24 hours</p>
          </div>
        </a>
      </div>

      {/* Emergency RSA strip */}
      <div style={s.rsaStrip}>
        <div style={s.rsaLeft}>
          <Zap size={18} color="#FFD600" />
          <div>
            <p style={s.rsaTitle}>Need Roadside Assistance?</p>
            <p style={s.rsaHint}>Our RSA team covers 50+ cities · avg response ~15 min</p>
          </div>
        </div>
        <a href="/my/book?service=breakdown" style={s.rsaBtn}>Request RSA</a>
      </div>

      {/* Send message */}
      <div style={s.card}>
        <div style={s.cardHead}><HelpCircle size={18} color="#f5a623" /><h2 style={s.cardTitle}>Send Us a Message</h2></div>
        {sent ? (
          <div style={s.successBox}>Your message has been sent! We'll respond within 24 hours.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea style={s.textarea} value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue or question..." rows={4} />
            <button style={s.sendBtn} onClick={() => { if (message.trim()) setSent(true) }}>Send Message</button>
          </div>
        )}
      </div>

      {/* FAQs */}
      <div style={s.card}>
        <div style={s.cardHead}><HelpCircle size={18} color="#f5a623" /><h2 style={s.cardTitle}>Frequently Asked Questions</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid #f0f2f8' : 'none' }}>
              <button style={s.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{faq.q}</span>
                {openFaq === i ? <ChevronUp size={16} color="#9aa3b8" /> : <ChevronDown size={16} color="#9aa3b8" />}
              </button>
              {openFaq === i && <p style={s.faqA}>{faq.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '24px' },
  header: {},
  title: { fontSize: '24px', fontWeight: '800', color: '#0f2044', margin: '0 0 4px' },
  sub: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  contactGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  contactCard: { display: 'flex', alignItems: 'flex-start', gap: '14px', background: 'white', borderRadius: '14px', padding: '18px', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f2f8', transition: 'box-shadow 0.15s' },
  contactIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  contactTitle: { fontSize: '14px', fontWeight: '700', color: '#0f2044', margin: '0 0 2px' },
  contactSub: { fontSize: '13px', color: '#333', fontWeight: '600', margin: '0 0 2px' },
  contactHint: { fontSize: '11px', color: '#9aa3b8', margin: 0 },
  card: { background: 'white', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '10px' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#0f2044', margin: 0 },
  textarea: { width: '100%', padding: '12px 14px', border: '1.5px solid #e2e6f0', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  sendBtn: { padding: '11px 24px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start' },
  successBox: { padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#16a34a', fontSize: '14px', fontWeight: '500' },
  faqQ: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 0', background: 'none', border: 'none', fontSize: '14px', fontWeight: '600', color: '#0f2044', cursor: 'pointer', textAlign: 'left', gap: '12px' },
  faqA: { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 14px', paddingRight: '24px' },

  // RSA strip
  rsaStrip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: '#0f2044', borderRadius: '14px', padding: '18px 20px', flexWrap: 'wrap' },
  rsaLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 },
  rsaTitle: { fontSize: '14px', fontWeight: '700', color: 'white', margin: '0 0 2px' },
  rsaHint: { fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: 0 },
  rsaBtn: { display: 'inline-flex', alignItems: 'center', padding: '9px 20px', background: '#FFD600', color: '#071530', borderRadius: '8px', fontSize: '13px', fontWeight: '800', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
}
