import { useState, FormEvent, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCustomerAuth } from '../hooks/useCustomerAuth'
import {
  customerPasswordLogin,
  getStoredAuth,
  requestCustomerOtp,
  setStoredAuth,
  verifyCustomerOtp,
  type CustomerOtpChannel,
  type CustomerOtpVerifyResponse,
} from '../lib/api'
import { ArrowRight, Phone, Mail, User, Shield, Eye, EyeOff, MessageCircle, ChevronLeft, CircleCheck as CheckCircle } from 'lucide-react'

type Step = 'phone' | 'otp' | 'register' | 'email-login'
type AuthMode = 'login' | 'signup'
const DASHBOARD_PATH = '/my/dashboard'

export default function CustomerAuthPage() {
  const { signIn, signUp, user, loading: authLoading } = useCustomerAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('phone')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [otpChannel, setOtpChannel] = useState<CustomerOtpChannel>('whatsapp')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [otpSessionId, setOtpSessionId] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const stored = getStoredAuth()
    const storedCustomer = stored?.token && stored.user?.id && stored.profile?.role === 'customer'
    if (!authLoading && (user || storedCustomer)) navigate(DASHBOARD_PATH, { replace: true })
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const getOtpPhone = () => {
    const digits = phone.replace(/\D/g, '')
    const national = digits.length > 10 ? digits.slice(-10) : digits
    return `+91${national}`
  }

  const storeAuthAndRedirect = (res: CustomerOtpVerifyResponse) => {
    const token = res.token || res.accessToken
    const userId = res.user?.id || res.profile?.id
    if (!token || !userId) return false

    setStoredAuth({
      token,
      user: { id: userId, email: res.user?.email || res.email || null },
      profile: res.profile
        ? { id: res.profile.id, role: res.profile.role }
        : { id: userId, role: res.user?.role || 'customer' },
    })
    window.location.replace(DASHBOARD_PATH)
    return true
  }

  const handleSendOtp = async (e: FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await requestCustomerOtp(getOtpPhone(), otpChannel)
      if (!res.success) throw new Error(res.message || 'Unable to send OTP')
      setOtpSessionId(res.session_id || '')
      setOtp(['', '', '', '', '', ''])
      setCountdown(30)
      setStep('otp')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (e) {
      setError((e as Error).message || 'OTP service is not configured yet')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) { setError('Enter a valid 10-digit mobile number'); return }
    if (!password) { setError('Enter your password'); return }
    setError('')
    setLoading(true)
    try {
      const res = await customerPasswordLogin(getOtpPhone(), password)
      if (!storeAuthAndRedirect(res)) throw new Error('Invalid login response')
    } catch (e) {
      setError((e as Error).message || 'Invalid phone or password')
      setLoading(false)
    }
  }

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[idx] = val.slice(-1)
    setOtp(next)
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus()
    if (next.every(d => d !== '') ) {
      // Auto-verify when all 6 digits entered
      handleVerifyOtp(next.join(''))
    }
  }

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleVerifyOtp = async (code?: string) => {
    const enteredOtp = code || otp.join('')
    if (enteredOtp.length < 6) { setError('Enter the 6-digit OTP'); return }
    setError('')
    setLoading(true)
    if (/^0{6}$/.test(enteredOtp)) {
      setError('Enter the OTP sent to your WhatsApp')
      setLoading(false)
      return
    }
    try {
      const phoneForAuth = getOtpPhone()
      const res = await verifyCustomerOtp(phoneForAuth, enteredOtp, otpSessionId || undefined, otpChannel)
      if (!res.success) throw new Error(res.message || 'Invalid OTP')

      if (storeAuthAndRedirect(res)) {
        setLoading(false)
        return
      }
      
      if (authMode === 'signup' || res.is_new_user === true) {
        setStep('register')
        setLoading(false)
        return
      }

      throw new Error('OTP verified, but login session was not returned. Backend OTP login update is required.')

    } catch (e) {
      setError((e as Error).message || 'Invalid OTP')
      setLoading(false)
      return
    }
    setLoading(false)
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Enter your full name'); return }
    setError('')
    setLoading(true)
    const normalizedPhone = getOtpPhone()
    const digits = normalizedPhone.replace(/\D/g, '')
    const accountEmail = email.trim() || `${digits}@bikeai.in`
    const accountPassword = password || `bike${digits}`
    const { error: err } = await signUp(accountEmail, accountPassword, fullName.trim(), normalizedPhone, {
      otpSessionId,
      channel: otpChannel,
    })
    if (err) {
      setError(err.message || 'Registration failed')
      setLoading(false)
      return
    }
    navigate(DASHBOARD_PATH, { replace: true })
  }

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) { setError(err.message || 'Invalid email or password'); setLoading(false); return }
    navigate(DASHBOARD_PATH, { replace: true })
  }

  const cleanPhone = phone.replace(/\D/g, '')

  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        *, *::before, *::after { box-sizing: border-box; }
        input:focus { outline: none !important; }
        .otp-input:focus { border-color: #FFD600 !important; background: #FFF9E6 !important; }
        .phone-input:focus { border-color: #FFD600 !important; box-shadow: 0 0 0 3px rgba(255,214,0,0.2) !important; }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-root { padding: 0 !important; }
          .auth-card { border-radius: 0 !important; min-height: 100vh !important; }
        }
      `}</style>

      {/* Background */}
      <div style={s.bg} />
      <div style={s.bgGlow} />

      {/* Navbar */}
      <nav style={s.nav}>
        <Link to="/" style={s.navLogo}>
          <div style={s.logoMark}>
            <img src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg" alt="BikeAI" style={s.logoImg} />
          </div>
          <span style={s.navBrand}>Bike<span style={s.navAccent}>AI</span></span>
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link to="/login" style={s.adminLink}>Admin Portal</Link>
        </div>
      </nav>

      <div style={s.content} className="auth-root">
        {/* Left info panel */}
        <div style={s.infoPanel} className="auth-left">
          <div>
            <h1 style={s.infoTitle}>
              Your Bike.<br />
              <span style={s.infoAccent}>Your Service.</span><br />
              Your Way.
            </h1>
            <p style={s.infoSub}>
              Book service, track live repairs, manage your garage, and get AI-powered assistance — all in one place.
            </p>

            <div style={s.featureGrid}>
              {[
                { icon: '🛵', text: 'Multi-vehicle garage' },
                { icon: '📍', text: 'Nearest dealer detection' },
                { icon: '🔴', text: 'Live repair tracking' },
                { icon: '🤖', text: 'AI service assistant' },
                { icon: '📄', text: 'Document vault' },
                { icon: '🚐', text: 'Free pickup & drop' },
              ].map(f => (
                <div key={f.text} style={s.featureItem}>
                  <span style={s.featureEmoji}>{f.icon}</span>
                  <span style={s.featureText}>{f.text}</span>
                </div>
              ))}
            </div>

            <div style={s.trustRow}>
              <div style={s.trustItem}><span style={s.trustNum}>50K+</span><span style={s.trustLabel}>Happy Riders</span></div>
              <div style={s.trustDivider} />
              <div style={s.trustItem}><span style={s.trustNum}>1.2K+</span><span style={s.trustLabel}>Service Centers</span></div>
              <div style={s.trustDivider} />
              <div style={s.trustItem}><span style={s.trustNum}>4.8★</span><span style={s.trustLabel}>App Rating</span></div>
            </div>
          </div>
        </div>

        {/* Auth card */}
        <div style={s.cardWrap}>
          <div style={s.card} className="auth-card">

            {/* Step: Phone entry */}
            {step === 'phone' && (
              <div style={s.stepWrap}>
                <div style={s.stepHeader}>
                  <div style={s.stepIconBig}><Phone size={22} color="#FFD600" /></div>
                  <h2 style={s.cardTitle}>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
                  <p style={s.cardSub}>
                    {authMode === 'login'
                      ? 'Enter your mobile number to login with WhatsApp OTP'
                      : 'Enter your mobile number to verify and create your account'}
                  </p>
                </div>

                <form onSubmit={authMode === 'login' ? handlePasswordLogin : handleSendOtp} style={s.form}>
                  {error && <ErrorBox msg={error} />}

                  <div style={s.modeTabs}>
                    <button
                      type="button"
                      style={{ ...s.modeTab, ...(authMode === 'login' ? s.modeTabActive : {}) }}
                      onClick={() => { setAuthMode('login'); setError('') }}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      style={{ ...s.modeTab, ...(authMode === 'signup' ? s.modeTabActive : {}) }}
                      onClick={() => { setAuthMode('signup'); setError('') }}
                    >
                      Sign Up
                    </button>
                  </div>

                  <div style={s.phoneWrap}>
                    <div style={s.phonePrefix}>+91</div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="98765 43210"
                      maxLength={15}
                      required
                      style={s.phoneInput}
                      className="phone-input"
                    />
                  </div>

                  {authMode === 'login' && (
                    <InputField label="Password" icon={<Shield size={15} color="#9aa3b8" />}>
                      <div style={{ position: 'relative' }}>
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" style={{ ...s.input, paddingRight: '44px' }} className="phone-input" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </InputField>
                  )}

                  <div style={s.modeTabs}>
                    <button
                      type="button"
                      style={{ ...s.modeTab, ...(otpChannel === 'whatsapp' ? s.modeTabActive : {}) }}
                      onClick={() => setOtpChannel('whatsapp')}
                    >
                      WhatsApp OTP
                    </button>
                    <button
                      type="button"
                      style={{ ...s.modeTab, ...(otpChannel === 'sms' ? s.modeTabActive : {}) }}
                      onClick={() => setOtpChannel('sms')}
                    >
                      SMS OTP
                    </button>
                  </div>

                  {authMode === 'login' && (
                    <button type="submit" disabled={loading || cleanPhone.length < 10 || !password} style={s.primaryBtn}>
                      {loading ? <Spinner /> : (
                        <><ArrowRight size={17} /> Login with Password</>
                      )}
                    </button>
                  )}

                  <button type={authMode === 'signup' ? 'submit' : 'button'} onClick={authMode === 'login' ? handleSendOtp : undefined} disabled={loading || cleanPhone.length < 10} style={authMode === 'login' ? s.secondaryBtn : s.primaryBtn}>
                    {loading ? <Spinner /> : (
                      <><MessageCircle size={17} /> Send OTP</>
                    )}
                  </button>
                </form>

                <p style={s.legal}>By continuing, you agree to our Terms of Service and Privacy Policy.</p>
              </div>
            )}

            {/* Step: OTP verify */}
            {step === 'otp' && (
              <div style={s.stepWrap}>
                <button style={s.backBtn} onClick={() => { setStep('phone'); setOtp(['','','','','','']); setError('') }}>
                  <ChevronLeft size={18} /> Back
                </button>
                <div style={s.stepHeader}>
                  <div style={{ ...s.stepIconBig, background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)' }}><Shield size={22} color="#22C55E" /></div>
                  <h2 style={s.cardTitle}>Verify OTP</h2>
                  <p style={s.cardSub}>We sent a 6-digit OTP to <strong>{getOtpPhone()}</strong> via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</p>
                </div>

                {error && <ErrorBox msg={error} />}

                <div style={s.otpRow}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpRefs.current[idx] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      style={s.otpInput}
                      className="otp-input"
                    />
                  ))}
                </div>

                <button
                  style={{ ...s.primaryBtn, marginTop: '8px', opacity: otp.every(d => d) ? 1 : 0.6 }}
                  disabled={loading || !otp.every(d => d)}
                  onClick={() => handleVerifyOtp()}
                >
                  {loading ? <Spinner /> : <><CheckCircle size={17} /> Verify & Continue</>}
                </button>

                <div style={s.resendRow}>
                  {countdown > 0 ? (
                    <span style={s.resendCountdown}>Resend OTP in {countdown}s</span>
                  ) : (
                    <button style={s.resendBtn} onClick={handleSendOtp as unknown as React.MouseEventHandler}>
                      <MessageCircle size={14} /> Resend OTP
                    </button>
                  )}
                </div>

              </div>
            )}

            {/* Step: Register new user */}
            {step === 'register' && (
              <div style={s.stepWrap}>
                <div style={s.stepHeader}>
                  <div style={{ ...s.stepIconBig, background: 'rgba(255,214,0,0.12)', border: '2px solid rgba(255,214,0,0.3)' }}><User size={22} color="#FFD600" /></div>
                  <h2 style={s.cardTitle}>Complete Your Profile</h2>
                  <p style={s.cardSub}>Just a few details to get you started</p>
                </div>

                <form onSubmit={handleRegister} style={s.form}>
                  {error && <ErrorBox msg={error} />}

                  <InputField label="Full Name" icon={<User size={15} color="#9aa3b8" />}>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Rahul Sharma" required style={s.input} className="phone-input" />
                  </InputField>

                  <InputField label="Email (optional)" icon={<Mail size={15} color="#9aa3b8" />}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={s.input} className="phone-input" />
                  </InputField>

                  <InputField label="Password (optional)" icon={<Shield size={15} color="#9aa3b8" />}>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Set a password (optional)" style={{ ...s.input, paddingRight: '44px' }} className="phone-input" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </InputField>

                  <button type="submit" disabled={loading} style={s.primaryBtn}>
                    {loading ? <Spinner /> : <><ArrowRight size={17} /> Create Account</>}
                  </button>
                </form>
              </div>
            )}

            {/* Step: Email login (admin/dealer) */}
            {step === 'email-login' && (
              <div style={s.stepWrap}>
                <button style={s.backBtn} onClick={() => { setStep('phone'); setError('') }}>
                  <ChevronLeft size={18} /> Back
                </button>
                <div style={s.stepHeader}>
                  <div style={{ ...s.stepIconBig, background: 'rgba(59,130,246,0.12)', border: '2px solid rgba(59,130,246,0.3)' }}><Mail size={22} color="#3B82F6" /></div>
                  <h2 style={s.cardTitle}>Sign In with Email</h2>
                  <p style={s.cardSub}>Use your email and password to sign in</p>
                </div>

                <form onSubmit={handleEmailLogin} style={s.form}>
                  {error && <ErrorBox msg={error} />}

                  <InputField label="Email Address" icon={<Mail size={15} color="#9aa3b8" />}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={s.input} className="phone-input" />
                  </InputField>

                  <InputField label="Password" icon={<Shield size={15} color="#9aa3b8" />}>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required style={{ ...s.input, paddingRight: '44px' }} className="phone-input" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </InputField>

                  <button type="submit" disabled={loading} style={s.primaryBtn}>
                    {loading ? <Spinner /> : <><ArrowRight size={17} /> Sign In</>}
                  </button>
                </form>

                <p style={{ ...s.legal, marginTop: '20px', textAlign: 'center' }}>
                  Don't have an account?{' '}
                  <button style={s.textLink} onClick={() => { setAuthMode('signup'); setStep('phone'); setError('') }}>Register with Mobile</button>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', color: '#DC2626', fontSize: '13px', animation: 'slideIn 0.2s ease' }}>
      <span style={{ width: '20px', height: '20px', background: '#DC2626', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>!</span>
      {msg}
    </div>
  )
}

function InputField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '5px' }}>{icon}{label}</label>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFD600', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
      Please wait…
    </span>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f4f6fb', fontFamily: '"Inter", system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden' },
  bg: { position: 'fixed', top: 0, left: 0, right: 0, height: '100vh', minHeight: '680px', background: 'linear-gradient(160deg, #0B1F4D 0%, #132B63 100%)', zIndex: 0 },
  bgGlow: { position: 'fixed', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,0,0.06) 0%, transparent 65%)', zIndex: 0, pointerEvents: 'none' },

  nav: { position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', maxWidth: '1200px', margin: '0 auto' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' },
  logoMark: { width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', border: '2px solid rgba(255,214,0,0.4)', flexShrink: 0 },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  navBrand: { fontSize: '20px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' },
  navAccent: { color: '#FFD600' },
  adminLink: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', padding: '7px 14px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px' },

  content: { position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '48px', padding: '36px 24px 80px', maxWidth: '1100px', minHeight: 'calc(100vh - 80px)', margin: '0 auto' },

  infoPanel: { flex: 1, maxWidth: '420px', paddingTop: '0' },
  infoTitle: { fontSize: '40px', fontWeight: '900', color: 'white', lineHeight: '1.15', letterSpacing: '-0.5px', marginBottom: '16px' },
  infoAccent: { color: '#FFD600' },
  infoSub: { fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.65', marginBottom: '32px' },
  featureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '32px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 13px' },
  featureEmoji: { fontSize: '18px' },
  featureText: { fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  trustRow: { display: 'flex', alignItems: 'center', gap: '20px' },
  trustItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  trustNum: { fontSize: '22px', fontWeight: '800', color: '#FFD600', letterSpacing: '-0.5px' },
  trustLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  trustDivider: { width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' },

  cardWrap: { width: '100%', maxWidth: '440px' },
  card: { background: 'white', borderRadius: '24px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(11,31,77,0.15)', border: '1px solid #e8ecf5' },
  stepWrap: { animation: 'slideIn 0.25s ease' },
  stepHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px', textAlign: 'center' },
  stepIconBig: { width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(255,214,0,0.12)', border: '2px solid rgba(255,214,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' },
  cardTitle: { fontSize: '22px', fontWeight: '800', color: '#0B1F4D', marginBottom: '6px', letterSpacing: '-0.3px' },
  cardSub: { fontSize: '14px', color: '#9aa3b8', lineHeight: '1.55' },

  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  modeTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '4px', border: '1.5px solid #e2e6f0', borderRadius: '12px', background: '#f8fafc' },
  modeTab: { border: 'none', borderRadius: '9px', background: 'transparent', color: '#64748b', padding: '9px 12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  modeTabActive: { background: '#0B1F4D', color: 'white' },
  phoneWrap: { display: 'flex', border: '1.5px solid #e2e6f0', borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s', background: 'white' },
  phonePrefix: { padding: '12px 14px', background: '#f4f6fb', borderRight: '1.5px solid #e2e6f0', fontSize: '15px', fontWeight: '700', color: '#0B1F4D', display: 'flex', alignItems: 'center', flexShrink: 0 },
  phoneInput: { flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: '16px', color: '#0B1F4D', fontFamily: 'inherit', letterSpacing: '0.05em', background: 'transparent' },
  input: { padding: '12px 14px', border: '1.5px solid #e2e6f0', borderRadius: '10px', fontSize: '14px', color: '#0B1F4D', background: 'white', width: '100%', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s' },
  eyeBtn: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9aa3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },

  primaryBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: '#0B1F4D', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', width: '100%', fontFamily: 'inherit', transition: 'all 0.15s' },
  secondaryBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: 'white', color: '#0B1F4D', border: '1.5px solid #e2e6f0', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%', fontFamily: 'inherit', transition: 'all 0.15s' },

  divider: { display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' },
  dividerLine: { flex: 1, height: '1px', background: '#e2e6f0' },
  dividerText: { fontSize: '13px', color: '#9aa3b8', fontWeight: '500' },

  otpRow: { display: 'flex', gap: '10px', justifyContent: 'center', margin: '8px 0 16px' },
  otpInput: { width: '48px', height: '56px', border: '2px solid #e2e6f0', borderRadius: '12px', textAlign: 'center', fontSize: '22px', fontWeight: '800', color: '#0B1F4D', background: 'white', fontFamily: 'inherit', transition: 'all 0.15s' },

  resendRow: { display: 'flex', justifyContent: 'center', marginTop: '16px' },
  resendCountdown: { fontSize: '13px', color: '#9aa3b8' },
  resendBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#0B1F4D', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  backBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#9aa3b8', fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: '0 0 16px', fontFamily: 'inherit' },

  legal: { marginTop: '16px', fontSize: '12px', color: '#9aa3b8', textAlign: 'center', lineHeight: '1.5' },
  textLink: { background: 'none', border: 'none', color: '#0B1F4D', fontWeight: '700', cursor: 'pointer', fontSize: '13px', padding: 0, fontFamily: 'inherit' },
}
