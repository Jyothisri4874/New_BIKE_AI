import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ShieldCheck,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import BookingFlow from '../components/BookingFlow'
import BookingChatWidget from '../components/BookingChatWidget'
import { getStoredAuth, setStoredAuth } from '../lib/api'

type Surface = {
  icon: LucideIcon
  title: string
  text: string
  route: string
}

const SURFACES: Surface[] = [
  {
    icon: CalendarCheck,
    title: 'Customer booking',
    text: 'Brand, model, service type, and location flow for riders.',
    route: '/my/book',
  },
  {
    icon: Wrench,
    title: 'Service queue',
    text: 'Workshop job cards, status updates, inspections, and approvals.',
    route: '/dealer/queue',
  },
  {
    icon: MessageSquare,
    title: 'Dealer CRM',
    text: 'Customers, reminders, follow-ups, templates, and timeline.',
    route: '/dealer/crm',
  },
  {
    icon: LayoutDashboard,
    title: 'Dealer portal',
    text: 'Daily dashboard for bookings, riders, vehicles, and operations.',
    route: '/dealer/dashboard',
  },
]

const SERVICE_POINTS = [
  'OEM and model-aware search',
  'GPS or city-based workshop matching',
  'Customer booking and tracking routes',
  'Dealer-scoped CRM and queue workflows',
]

const WORKFLOW = [
  ['01', 'Customer selects bike and service'],
  ['02', 'BikeAI filters matching workshops'],
  ['03', 'Booking moves into dealer operations'],
  ['04', 'CRM reminders and updates stay logged'],
]

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [auth, setAuth] = useState(() => getStoredAuth())
  const customerLoggedIn = Boolean(auth?.token && auth.user?.id && auth.profile?.role === 'customer')

  const handleCustomerLogout = () => {
    setStoredAuth(null)
    setAuth(null)
    setMobileOpen(false)
  }

  return (
    <div style={s.root}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        a { text-decoration: none; }
        .nav-link:hover { color: #ffd600 !important; }
        .button-primary:hover { background: #e5c100 !important; transform: translateY(-1px); }
        .button-secondary:hover { border-color: rgba(255,255,255,0.48) !important; background: rgba(255,255,255,0.06) !important; }
        .surface-card:hover { border-color: #aeb7c8 !important; background: #fbfcff !important; }
        .mobile-link:hover { color: #ffd600 !important; }
        @media (max-width: 980px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: inline-flex !important; }
          .hero-grid { grid-template-columns: 1fr !important; gap: 34px !important; }
          .hero-copy { max-width: 760px !important; }
          .booking-column { max-width: 720px !important; }
          .service-strip { grid-template-columns: repeat(2, 1fr) !important; }
          .surface-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .workflow-grid { grid-template-columns: 1fr !important; }
          .dealer-band-inner { align-items: flex-start !important; flex-direction: column !important; }
        }
        @media (max-width: 640px) {
          .nav { height: 64px !important; padding: 0 16px !important; }
          .hero { padding: 36px 16px 34px !important; }
          .hero-title { font-size: 38px !important; line-height: 1.08 !important; }
          .hero-actions { flex-direction: column !important; align-items: stretch !important; }
          .hero-actions a { justify-content: center !important; }
          .service-strip,
          .surface-grid,
          .workflow-list { grid-template-columns: 1fr !important; }
          .section { padding: 50px 16px !important; }
          .booking-heading { flex-direction: column !important; align-items: flex-start !important; }
          .footer-inner { align-items: flex-start !important; flex-direction: column !important; }
        }
      `}</style>

      <header style={s.header}>
        <nav style={s.nav} className="nav">
          <Link to="/" style={s.brand} aria-label="BikeAI home">
            <span style={s.logoFrame}>
              <img src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg" alt="BikeAI" style={s.logoImg} />
            </span>
            <span style={s.brandName}>Bike<span style={s.yellowText}>AI</span></span>
          </Link>

          <div style={s.navLinks} className="desktop-nav">
            <a href="#book-service" style={s.navLink} className="nav-link">Book Service</a>
            <a href="#platform" style={s.navLink} className="nav-link">Platform</a>
            <a href="#workflow" style={s.navLink} className="nav-link">Workflow</a>
            <Link to="/for-dealers" style={s.navLink} className="nav-link">For Dealers</Link>
            <Link to="/my/bookings" style={s.navLink} className="nav-link">Track Booking</Link>
          </div>

          <div style={s.navActions} className="desktop-nav">
            {customerLoggedIn ? (
              <>
                <Link to="/my/dashboard" style={s.signIn}>My Dashboard</Link>
                <button type="button" style={s.logoutBtn} onClick={handleCustomerLogout}>Logout</button>
              </>
            ) : (
              <Link to="/my/auth" style={s.signIn}>Customer Sign In</Link>
            )}
            <Link to="/dealer/auth" style={s.navCta}>Dealer Login</Link>
          </div>

          <button
            type="button"
            style={s.mobileToggle}
            className="mobile-toggle"
            onClick={() => setMobileOpen(open => !open)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {mobileOpen && (
          <div style={s.mobileMenu}>
            <a href="#book-service" style={s.mobileLink} className="mobile-link" onClick={() => setMobileOpen(false)}>Book Service</a>
            <a href="#platform" style={s.mobileLink} className="mobile-link" onClick={() => setMobileOpen(false)}>Platform</a>
            <a href="#workflow" style={s.mobileLink} className="mobile-link" onClick={() => setMobileOpen(false)}>Workflow</a>
            <Link to="/for-dealers" style={s.mobileLink} className="mobile-link" onClick={() => setMobileOpen(false)}>For Dealers</Link>
            <Link to="/my/bookings" style={s.mobileLink} className="mobile-link" onClick={() => setMobileOpen(false)}>Track Booking</Link>
            {customerLoggedIn ? (
              <>
                <Link to="/my/dashboard" style={s.mobileStrong} onClick={() => setMobileOpen(false)}>My Dashboard</Link>
                <button type="button" style={s.mobileButton} onClick={handleCustomerLogout}>Logout</button>
              </>
            ) : (
              <Link to="/my/auth" style={s.mobileStrong} onClick={() => setMobileOpen(false)}>Customer Sign In</Link>
            )}
            <Link to="/dealer/auth" style={s.mobileStrong} onClick={() => setMobileOpen(false)}>Dealer Login</Link>
          </div>
        )}
      </header>

      <main>
        <section style={s.hero} className="hero">
          <div style={s.heroGrid} className="hero-grid">
            <div style={s.heroCopy} className="hero-copy">
              <div style={s.kicker}><ShieldCheck size={15} /> Automotive service SaaS</div>
              <h1 style={s.heroTitle} className="hero-title">BikeAI Service Platform</h1>
              <p style={s.heroText}>
                A sharper service front door for two-wheeler owners and dealer teams: find the right workshop, book the job, and keep CRM and service operations moving from the same platform.
              </p>

              <div style={s.heroActions} className="hero-actions">
                <a href="#book-service" style={s.primaryButton} className="button-primary">
                  Find Service Centers <ArrowRight size={18} />
                </a>
                <Link to="/dealer/auth" style={s.secondaryButton} className="button-secondary">
                  Dealer Login <LayoutDashboard size={18} />
                </Link>
              </div>

              <div style={s.serviceStrip} className="service-strip">
                {SERVICE_POINTS.map(point => (
                  <div key={point} style={s.servicePoint}>
                    <CheckCircle2 size={15} color={yellow} />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div id="book-service" style={s.bookingColumn} className="booking-column">
              <div style={s.bookingHeading} className="booking-heading">
                <div>
                  <span style={s.bookingEyebrow}>Live booking flow</span>
                  <h2 style={s.bookingTitle}>Find a workshop that matches the bike and job.</h2>
                </div>
                <span style={s.bookingBadge}>No route changes</span>
              </div>
              <BookingFlow />
            </div>
          </div>
        </section>

        <section id="platform" style={s.section} className="section">
          <div style={s.sectionHeader}>
            <span style={s.eyebrow}>Existing app surfaces</span>
            <h2 style={s.sectionTitle}>One homepage, direct paths into the workflows already in production.</h2>
            <p style={s.sectionCopy}>
              The landing page stays focused on routing customers and dealers into the live booking, CRM, and service operations screens.
            </p>
          </div>

          <div style={s.surfaceGrid} className="surface-grid">
            {SURFACES.map(item => (
              <Link to={item.route} key={item.title} style={s.surfaceCard} className="surface-card">
                <span style={s.surfaceIcon}><item.icon size={20} /></span>
                <h3 style={s.surfaceTitle}>{item.title}</h3>
                <p style={s.surfaceText}>{item.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="workflow" style={s.workflowBand}>
          <div style={s.workflowGrid} className="workflow-grid">
            <div>
              <span style={s.eyebrow}>Connected workflow</span>
              <h2 style={s.workflowTitle}>From a rider search to a dealer-ready service record.</h2>
              <p style={s.workflowCopy}>
                BikeAI keeps the public booking experience close to the operational screens dealers already use.
              </p>
            </div>
            <div style={s.workflowList} className="workflow-list">
              {WORKFLOW.map(([number, label]) => (
                <div key={number} style={s.workflowStep}>
                  <span style={s.workflowNumber}>{number}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={s.dealerBand}>
          <div style={s.dealerBandInner} className="dealer-band-inner">
            <div>
              <span style={s.dealerEyebrow}>Dealer operations</span>
              <h2 style={s.dealerTitle}>Service queue, CRM reminders, and workshop data stay inside dealer-scoped routes.</h2>
            </div>
            <Link to="/for-dealers" style={s.dealerButton}>
              View Dealer Platform <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer style={s.footer}>
        <div style={s.footerInner} className="footer-inner">
          <Link to="/" style={s.footerBrand}>Bike<span style={s.yellowText}>AI</span></Link>
          <div style={s.footerLinks}>
            <Link to="/my/book" style={s.footerLink}>Book Service</Link>
            <Link to="/my/bookings" style={s.footerLink}>Track Booking</Link>
            <Link to="/dealer/auth" style={s.footerLink}>Dealer Login</Link>
          </div>
        </div>
      </footer>

      <BookingChatWidget />
    </div>
  )
}

const navy = '#071a3f'
const navy3 = '#102a56'
const yellow = '#ffd600'
const slate = '#667085'
const border = '#d8deea'

const s: Record<string, CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#ffffff',
    color: navy,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflowX: 'hidden',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    background: navy,
    borderBottom: '1px solid rgba(255,255,255,0.12)',
  },
  nav: {
    maxWidth: 1180,
    height: 72,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 26,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  logoFrame: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid rgba(255,214,0,0.42)',
    background: '#ffffff',
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  brandName: { color: '#ffffff', fontSize: 21, fontWeight: 850, letterSpacing: 0 },
  yellowText: { color: yellow },
  navLinks: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 23, flex: 1 },
  navLink: { color: 'rgba(255,255,255,0.74)', fontSize: 14, fontWeight: 700, letterSpacing: 0 },
  navActions: { display: 'flex', alignItems: 'center', gap: 10 },
  signIn: {
    color: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 750,
  },
  logoutBtn: {
    color: 'rgba(255,255,255,0.82)',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 750,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  navCta: {
    color: navy,
    background: yellow,
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 850,
  },
  mobileToggle: {
    display: 'none',
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    color: '#ffffff',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 8,
    cursor: 'pointer',
  },
  mobileMenu: {
    display: 'grid',
    gap: 2,
    padding: '8px 24px 18px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    background: navy,
  },
  mobileLink: { color: 'rgba(255,255,255,0.82)', padding: '12px 0', fontSize: 14, fontWeight: 700 },
  mobileStrong: { color: yellow, padding: '12px 0', fontSize: 14, fontWeight: 850 },
  mobileButton: {
    color: yellow,
    background: 'transparent',
    border: 0,
    padding: '12px 0',
    textAlign: 'left',
    fontSize: 14,
    fontWeight: 850,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },

  hero: { background: navy, padding: '64px 24px 58px' },
  heroGrid: {
    maxWidth: 1180,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.92fr) minmax(420px, 520px)',
    gap: 52,
    alignItems: 'start',
  },
  heroCopy: { maxWidth: 620, paddingTop: 18 },
  kicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: yellow,
    background: '#13284f',
    border: '1px solid rgba(255,214,0,0.24)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 850,
    marginBottom: 20,
  },
  heroTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: 58,
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: 0,
  },
  heroText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 18,
    lineHeight: 1.66,
    margin: '22px 0 0',
    maxWidth: 620,
  },
  heroActions: { display: 'flex', gap: 12, marginTop: 30, alignItems: 'center' },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 9,
    color: navy,
    background: yellow,
    padding: '14px 19px',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 900,
    transition: 'all 0.16s ease',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 9,
    color: '#ffffff',
    background: 'transparent',
    padding: '13px 18px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.28)',
    fontSize: 15,
    fontWeight: 850,
    transition: 'all 0.16s ease',
  },
  serviceStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    marginTop: 34,
  },
  servicePoint: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    minHeight: 48,
    padding: '11px 12px',
    color: 'rgba(255,255,255,0.78)',
    background: navy3,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 750,
  },
  bookingColumn: { width: '100%', scrollMarginTop: 92 },
  bookingHeading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 14,
  },
  bookingEyebrow: {
    display: 'block',
    color: yellow,
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 5,
  },
  bookingTitle: { margin: 0, color: '#ffffff', fontSize: 22, lineHeight: 1.2, fontWeight: 900 },
  bookingBadge: {
    color: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: 'nowrap',
  },

  section: { maxWidth: 1180, margin: '0 auto', padding: '72px 24px 64px' },
  sectionHeader: { maxWidth: 720, marginBottom: 30 },
  eyebrow: {
    display: 'block',
    color: '#9a7a00',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 10,
  },
  sectionTitle: { margin: 0, color: navy, fontSize: 34, lineHeight: 1.18, fontWeight: 900, letterSpacing: 0 },
  sectionCopy: { margin: '12px 0 0', color: slate, fontSize: 16, lineHeight: 1.65, fontWeight: 500 },
  surfaceGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  surfaceCard: {
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: 20,
    background: '#ffffff',
    transition: 'all 0.14s ease',
  },
  surfaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: navy,
    background: '#fff7bf',
    marginBottom: 16,
  },
  surfaceTitle: { margin: 0, color: navy, fontSize: 16, fontWeight: 900 },
  surfaceText: { margin: '8px 0 0', color: slate, fontSize: 14, lineHeight: 1.55, fontWeight: 500 },

  workflowBand: { background: '#f5f7fb', borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` },
  workflowGrid: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '54px 24px',
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 440px) 1fr',
    gap: 42,
    alignItems: 'center',
  },
  workflowTitle: { margin: 0, color: navy, fontSize: 30, lineHeight: 1.2, fontWeight: 900 },
  workflowCopy: { margin: '12px 0 0', color: slate, fontSize: 15, lineHeight: 1.6 },
  workflowList: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  workflowStep: {
    minHeight: 104,
    display: 'grid',
    alignContent: 'center',
    gap: 10,
    background: '#ffffff',
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: 15,
    color: navy,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },
  workflowNumber: { color: '#9aa5ba', fontSize: 12, fontWeight: 900 },

  dealerBand: { background: navy, padding: '44px 24px' },
  dealerBandInner: {
    maxWidth: 1180,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 28,
  },
  dealerEyebrow: {
    display: 'block',
    color: yellow,
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 10,
  },
  dealerTitle: { margin: 0, color: '#ffffff', fontSize: 28, lineHeight: 1.24, fontWeight: 900, maxWidth: 760 },
  dealerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: navy,
    background: yellow,
    borderRadius: 8,
    padding: '13px 18px',
    fontSize: 14,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  footer: { background: '#061128', padding: '24px' },
  footerInner: {
    maxWidth: 1180,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    flexWrap: 'wrap',
  },
  footerBrand: { color: '#ffffff', fontSize: 18, fontWeight: 900 },
  footerLinks: { display: 'flex', gap: 18, flexWrap: 'wrap' },
  footerLink: { color: 'rgba(255,255,255,0.66)', fontSize: 13, fontWeight: 750 },
}
