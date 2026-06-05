import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useDealerAuth } from '../hooks/useDealerAuth'
import { Eye, EyeOff, ArrowRight, Shield, Wrench, ChartBar as BarChart2, Users, Zap } from 'lucide-react'

type Tab = 'login' | 'register'

export default function DealerAuthPage() {
  const { signIn, signUp, user, profile } = useDealerAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [tab, setTab] = useState<Tab>(params.get('tab') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && profile && ['dealer', 'admin', 'crm', 'service_manager'].includes(profile.role)) {
      navigate('/dealer/dashboard')
    }
  }, [user, profile, navigate])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) { setError(err.message || 'Invalid credentials'); setLoading(false); return }
    navigate('/dealer/dashboard')
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !businessName.trim()) { setError('All fields are required'); return }
    setError('')
    setLoading(true)
    const { error: err } = await signUp(email, password, fullName, phone, businessName)
    if (err) { setError(err.message || 'Registration failed'); setLoading(false); return }
    navigate('/dealer/dashboard')
  }

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        *, *::before, *::after { box-sizing: border-box; }
        input:focus { outline: none !important; border-color: #FFD600 !important; box-shadow: 0 0 0 3px rgba(255,214,0,0.15) !important; }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-wrap { padding: 0 !important; }
          .auth-card { border-radius: 0 !important; min-height: 100vh !important; }
        }
      `}</style>

      <div style={s.bg} />
      <div style={s.bgGlow} />

      {/* Navbar */}
      <nav style={s.nav}>
        <Link to="/for-dealers" style={s.navLogo}>
          <div style={s.logoMark}><img src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg" alt="BikeAI" style={s.logoImg} /></div>
          <span style={s.navBrand}>Bike<span style={{ color: '#FFD600' }}>AI</span></span>
          <span style={s.navBadge}>Dealer Portal</span>
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link to="/" style={s.customerLink}>Customer App</Link>
          <Link to="/login" style={s.adminLink}>Admin</Link>
        </div>
      </nav>

      <div style={s.wrap} className="auth-wrap">
        {/* Left panel */}
        <div style={s.leftPanel} className="auth-left">
          <div style={s.leftInner}>
            <div style={s.leftBadge}>
              <Shield size={14} color="#FFD600" /> Dealer Operations Platform
            </div>
            <h1 style={s.leftTitle}>
              Run Your Workshop<br />
              <span style={{ color: '#FFD600' }}>Smarter.</span><br />
              Grow Faster.
            </h1>
            <p style={s.leftSub}>
              Digital operations, CRM, analytics, and AI automation — all in one dealer dashboard.
            </p>
            <div style={s.leftFeatures}>
              {[
                { icon: Wrench, text: 'Live job card management' },
                { icon: BarChart2, text: 'Revenue & analytics dashboard' },
                { icon: Users, text: 'Customer CRM & retention' },
                { icon: Zap, text: 'AI-powered service automation' },
              ].map(f => (
                <div key={f.text} style={s.leftFeatureItem}>
                  <div style={s.leftFeatureIcon}><f.icon size={15} color="#FFD600" /></div>
                  <span style={s.leftFeatureText}>{f.text}</span>
                </div>
              ))}
            </div>
            <div style={s.trustRow}>
              {[['1,200+', 'Partners'], ['3x', 'More Bookings'], ['₹0', 'Setup Cost']].map(([v, l]) => (
                <div key={l} style={s.trustItem}>
                  <span style={s.trustVal}>{v}</span>
                  <span style={s.trustLabel}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right card */}
        <div style={s.cardWrap}>
          <div style={s.card} className="auth-card">
            {/* Tab toggle */}
            <div style={s.tabs}>
              <button style={{ ...s.tab, ...(tab === 'login' ? s.tabActive : {}) }} onClick={() => { setTab('login'); setError('') }}>Sign In</button>
              <button style={{ ...s.tab, ...(tab === 'register' ? s.tabActive : {}) }} onClick={() => { setTab('register'); setError('') }}>Become a Partner</button>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} style={s.form} key="login">
                <div style={s.fieldGroup}>
                  <label style={s.label}>Business Email</label>
                  <input style={s.input} type="email" placeholder="owner@workshop.in" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...s.input, paddingRight: '44px' }} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                    <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(v => !v)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" style={s.submitBtn} disabled={loading}>
                  {loading ? <span style={s.spinner} /> : <><span>Sign In to Dashboard</span><ArrowRight size={16} /></>}
                </button>
                <div style={s.switchHint}>
                  New dealer? <button type="button" style={s.switchLink} onClick={() => setTab('register')}>Create a partner account →</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={s.form} key="register">
                <div style={s.fieldRow}>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Full Name</label>
                    <input style={s.input} type="text" placeholder="Rajesh Kumar" value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Mobile Number</label>
                    <input style={s.input} type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Workshop / Business Name</label>
                  <input style={s.input} type="text" placeholder="SpeedAuto Service Center" value={businessName} onChange={e => setBusinessName(e.target.value)} required />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Business Email</label>
                  <input style={s.input} type="email" placeholder="owner@workshop.in" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...s.input, paddingRight: '44px' }} type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(v => !v)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" style={s.submitBtn} disabled={loading}>
                  {loading ? <span style={s.spinner} /> : <><span>Create Partner Account</span><ArrowRight size={16} /></>}
                </button>
                <div style={s.switchHint}>
                  Already a partner? <button type="button" style={s.switchLink} onClick={() => setTab('login')}>Sign in →</button>
                </div>
              </form>
            )}

            <div style={s.cardFooter}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Protected by Supabase Auth · Role-Based Access Control</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { fontFamily: '"Inter", system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#0B1F4D', position: 'relative', overflowX: 'hidden' },
  bg: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg, #0B1F4D 0%, #081428 100%)', zIndex: 0 },
  bgGlow: { position: 'fixed', top: '-150px', right: '-150px', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,0,0.06) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 },

  nav: { position: 'relative', zIndex: 10, padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' },
  logoMark: { width: '30px', height: '30px', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid rgba(255,214,0,0.35)', flexShrink: 0 },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  navBrand: { fontSize: '17px', fontWeight: '800', color: 'white', letterSpacing: '-0.2px' },
  navBadge: { padding: '2px 8px', background: 'rgba(255,214,0,0.14)', border: '1px solid rgba(255,214,0,0.28)', borderRadius: '20px', fontSize: '11px', fontWeight: '600', color: '#FFD600' },
  customerLink: { fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px' },
  adminLink: { fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' },

  wrap: { position: 'relative', zIndex: 1, display: 'flex', minHeight: 'calc(100vh - 60px)', padding: '40px 24px' },
  leftPanel: { flex: 1, display: 'flex', alignItems: 'center', paddingRight: '60px' },
  leftInner: { maxWidth: '440px' },
  leftBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,214,0,0.12)', border: '1px solid rgba(255,214,0,0.25)', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', color: '#FFD600', marginBottom: '24px' },
  leftTitle: { fontSize: '42px', fontWeight: '900', color: 'white', lineHeight: '1.1', margin: '0 0 16px', letterSpacing: '-0.8px' },
  leftSub: { fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.65', marginBottom: '32px' },
  leftFeatures: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' },
  leftFeatureItem: { display: 'flex', alignItems: 'center', gap: '12px' },
  leftFeatureIcon: { width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  leftFeatureText: { fontSize: '14px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  trustRow: { display: 'flex', gap: '28px' },
  trustItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  trustVal: { fontSize: '24px', fontWeight: '900', color: '#FFD600', letterSpacing: '-0.3px' },
  trustLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' },

  cardWrap: { flexShrink: 0, width: '460px', display: 'flex', alignItems: 'center' },
  card: { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', animation: 'slideIn 0.3s ease' },

  tabs: { display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '4px', marginBottom: '24px', gap: '4px' },
  tab: { flex: 1, padding: '9px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  tabActive: { background: '#FFD600', color: '#0B1F4D' },

  errorBox: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#fca5a5', marginBottom: '16px' },

  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  fieldRow: { display: 'flex', gap: '12px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label: { fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' },
  input: { padding: '11px 14px', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '10px', fontSize: '14px', color: 'white', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s', width: '100%' },
  eyeBtn: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' },
  submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 20px', background: '#FFD600', color: '#0B1F4D', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px', transition: 'all 0.2s' },
  spinner: { width: '18px', height: '18px', border: '2px solid rgba(11,31,77,0.3)', borderTopColor: '#0B1F4D', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' },
  switchHint: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '4px' },
  switchLink: { background: 'none', border: 'none', color: '#FFD600', fontWeight: '600', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0 },
  cardFooter: { marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' },
}
