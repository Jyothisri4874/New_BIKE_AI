import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const { signIn, user, profile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user && profile?.role === 'admin') {
    navigate('/admin/dashboard')
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message || 'Invalid email or password')
      setLoading(false)
    } else {
      navigate('/admin/dashboard')
    }
  }

  return (
    <div style={styles.container}>
      {/* Left panel */}
      <div style={styles.leftPanel}>
        <div style={styles.leftContent}>
          {/* Logo */}
          <div style={styles.logoSection}>
            <div style={styles.logoImgWrap}>
              <img
                src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg"
                alt="BikeAI Logo"
                style={styles.logoImg}
              />
            </div>
            <div>
              <h1 style={styles.brandName}>
                Bike<span style={styles.brandAI}>AI</span>
              </h1>
              <p style={styles.brandTagline}>Smarter Bikes. Trusted Platform.</p>
            </div>
          </div>

          {/* Headline */}
          <div style={styles.heroText}>
            <h2 style={styles.heroTitle}>
              India's Smartest<br />
              <span style={styles.heroHighlight}>Two-Wheeler</span><br />
              Service Platform
            </h2>
            <p style={styles.heroSub}>
              Manage dealers, bookings, and users from a single powerful admin portal.
            </p>
          </div>

          {/* Feature pills */}
          <div style={styles.pills}>
            {['Real-time Dealer Management', 'Booking Analytics', 'Multi-role Access', 'Pan-India Coverage'].map(f => (
              <span key={f} style={styles.pill}>{f}</span>
            ))}
          </div>
        </div>

        {/* Bottom decoration */}
        <div style={styles.leftDecor} />
      </div>

      {/* Right panel */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          <div style={styles.formTop}>
            <div style={styles.formLogoSmall}>
              <img
                src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg"
                alt="BikeAI"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <h2 style={styles.formTitle}>Admin Sign In</h2>
            <p style={styles.formSub}>Access the BikeAI management portal</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBanner}>
                <span style={styles.errorDot}>!</span>
                {error}
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@bikeai.in"
                required
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ ...styles.input, paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span style={styles.btnSpinner} />
                  Signing in...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  Sign In
                  <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <p style={styles.hint}>
            Contact your system administrator for access.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none !important; border-color: #f5e019 !important; box-shadow: 0 0 0 3px rgba(245,224,25,0.2) !important; }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '480px',
    background: '#0f2044',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '48px',
    position: 'relative',
    overflow: 'hidden',
  },
  leftContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    position: 'relative',
    zIndex: 1,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  logoImgWrap: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    overflow: 'hidden',
    border: '2px solid rgba(245,224,25,0.4)',
    flexShrink: 0,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  brandName: {
    fontSize: '28px',
    fontWeight: '800',
    color: 'white',
    lineHeight: '1.1',
    letterSpacing: '-0.5px',
  },
  brandAI: {
    color: '#f5e019',
  },
  brandTagline: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.04em',
    marginTop: '2px',
  },
  heroText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  heroTitle: {
    fontSize: '38px',
    fontWeight: '800',
    color: 'white',
    lineHeight: '1.15',
    letterSpacing: '-0.5px',
  },
  heroHighlight: {
    color: '#f5e019',
  },
  heroSub: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1.65',
    maxWidth: '340px',
  },
  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  pill: {
    padding: '6px 14px',
    background: 'rgba(245,224,25,0.1)',
    border: '1px solid rgba(245,224,25,0.25)',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#f5e019',
    fontWeight: '500',
  },
  leftDecor: {
    position: 'absolute',
    bottom: '-80px',
    right: '-80px',
    width: '280px',
    height: '280px',
    borderRadius: '50%',
    background: 'rgba(245,224,25,0.04)',
    border: '1px solid rgba(245,224,25,0.08)',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8f9fc',
    padding: '32px',
  },
  formCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 40px rgba(15,32,68,0.1)',
    border: '1px solid #e2e6f0',
  },
  formTop: {
    marginBottom: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  formLogoSmall: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '12px',
    border: '2px solid rgba(15,32,68,0.1)',
  },
  formTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f2044',
    letterSpacing: '-0.3px',
  },
  formSub: {
    color: '#9aa3b8',
    fontSize: '13.5px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#333a52',
  },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #e2e6f0',
    borderRadius: '9px',
    fontSize: '14px',
    color: '#0f2044',
    background: '#fff',
    width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#9aa3b8',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '4px',
  },
  submitBtn: {
    padding: '12px 16px',
    background: '#0f2044',
    color: 'white',
    border: 'none',
    borderRadius: '9px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s',
    marginTop: '4px',
    position: 'relative',
    overflow: 'hidden',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#f5e019',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '9px',
    color: '#dc2626',
    fontSize: '13px',
  },
  errorDot: {
    width: '20px',
    height: '20px',
    background: '#dc2626',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0,
  },
  hint: {
    marginTop: '20px',
    textAlign: 'center',
    color: '#9aa3b8',
    fontSize: '12px',
  },
}
