import { Link } from 'react-router-dom'
import {
  ChartBar as BarChart2, Users, Wrench, Truck, Package, TrendingUp, Bot, Bell,
  Star, CircleCheck as CheckCircle, ArrowRight, ChevronRight, Zap, MapPin,
  LayoutDashboard, MessageSquare, ClipboardList, UserCheck,
  LogIn,
} from 'lucide-react'

// ── Portal definitions ─────────────────────────────────────────────────────────

const PORTALS = [
  {
    id: 'dealer',
    title: 'Dealer Dashboard',
    subtitle: 'Workshop Operations',
    desc: 'Manage bookings, service queue, technicians, inventory, and billing.',
    loginPath: '/dealer/auth',
    registerPath: '/dealer/auth?tab=register',
    color: '#FFD600',
    textColor: '#0B1F4D',
    bg: 'linear-gradient(135deg, #0B1F4D 0%, #132B63 100%)',
    features: ['Service Queue', 'Technician Mgmt', 'Pickup & Drop', 'Inventory', 'Billing'],
    Icon: LayoutDashboard,
  },
  {
    id: 'crm',
    title: 'CRM Dashboard',
    subtitle: 'Customer Engagement',
    desc: 'Service reminders, WhatsApp campaigns, loyalty programs, and retention analytics.',
    loginPath: '/dealer/auth?role=crm',
    registerPath: '/dealer/auth?tab=register',
    color: '#10B981',
    textColor: 'white',
    bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    features: ['Service Reminders', 'WhatsApp Campaigns', 'Follow-ups', 'Loyalty Programs', 'Feedback'],
    Icon: MessageSquare,
  },
  {
    id: 'service_manager',
    title: 'Service Manager',
    subtitle: 'Workshop Floor Ops',
    desc: 'Active repairs, technician assignments, QC checks, parts tracking, and delivery queue.',
    loginPath: '/dealer/auth?role=service_manager',
    registerPath: '/dealer/auth?tab=register',
    color: '#F59E0B',
    textColor: 'white',
    bg: 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
    features: ['Active Repairs', 'Job Cards', 'QC Approvals', 'Parts Pending', 'Delivery Queue'],
    Icon: ClipboardList,
  },
  {
    id: 'admin',
    title: 'Admin Dashboard',
    subtitle: 'Platform Intelligence',
    desc: 'Dealer approvals, OEM management, revenue analytics, and platform monitoring.',
    loginPath: '/login',
    registerPath: '/login',
    color: '#8B5CF6',
    textColor: 'white',
    bg: 'linear-gradient(135deg, #2e1065 0%, #3b0764 100%)',
    features: ['Dealer Approvals', 'Revenue Analytics', 'OEM Management', 'Platform Health', 'Subscriptions'],
    Icon: BarChart2,
  },
]

const BENEFITS = [
  { icon: BarChart2, title: 'Revenue Analytics', desc: 'Real-time revenue tracking, job card analytics, and monthly growth reports.', color: '#3B82F6' },
  { icon: Users, title: 'CRM & Retention', desc: 'Service reminders, WhatsApp campaigns, and loyalty programs.', color: '#10B981' },
  { icon: Wrench, title: 'Workshop Operations', desc: 'Digital job cards, technician assignments, and live repair tracking.', color: '#FFD600' },
  { icon: Truck, title: 'Pickup & Drop', desc: 'Assign riders, track pickups, and manage doorstep delivery.', color: '#EF4444' },
  { icon: Package, title: 'Inventory Control', desc: 'Parts management, low-stock alerts, and supplier orders.', color: '#F59E0B' },
  { icon: TrendingUp, title: 'AI Automation', desc: 'AI-powered recommendations, automated follow-ups, smart scheduling.', color: '#8B5CF6' },
  { icon: Bell, title: 'Smart Notifications', desc: 'Automated WhatsApp, SMS, and in-app alerts every step.', color: '#06B6D4' },
  { icon: Bot, title: 'AI Assistant', desc: 'Intelligent chatbot for customer queries, bookings, and status.', color: '#EC4899' },
]

const STATS = [
  { value: '3x', label: 'More Bookings' },
  { value: '₹0', label: 'Setup Cost' },
  { value: '24/7', label: 'Dashboard Access' },
  { value: '1,200+', label: 'Partners Onboarded' },
]

const TESTIMONIALS = [
  { name: 'Rajesh Kumar', role: 'Owner, SpeedAuto Service, Hyderabad', text: 'BikeAI tripled our monthly bookings within 60 days. The WhatsApp reminders alone brought back 40% of dormant customers.', rating: 5 },
  { name: 'Meena Sharma', role: 'Service Manager, FastTrack Bikes, Pune', text: 'The workshop dashboard is incredible. We went from paper job cards to fully digital operations in a week.', rating: 5 },
  { name: 'Arjun Nair', role: 'Dealer Principal, Nair AutoTech, Kochi', text: 'Inventory alerts and parts tracking have reduced our downtime significantly. Highly recommended.', rating: 5 },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ForDealersPage() {
  return (
    <div style={s.root}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }
        a { text-decoration: none; }
        img { display: block; }
        .benefit-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(11,31,77,0.12) !important; }
        .portal-card:hover { transform: translateY(-3px); box-shadow: 0 20px 50px rgba(0,0,0,0.4) !important; }
        .portal-login:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .cta-primary:hover { background: #e6c200 !important; transform: translateY(-1px); }
        .cta-dark:hover { background: #132B63 !important; transform: translateY(-1px); }
        .nav-link:hover { color: #FFD600 !important; }
        @media (max-width: 900px) {
          .portals-grid { grid-template-columns: 1fr 1fr !important; }
          .hero-cols { flex-direction: column !important; gap: 32px !important; }
          .benefits-grid { grid-template-columns: 1fr 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .footer-cols { flex-direction: column !important; gap: 24px !important; }
          .hide-mob { display: none !important; }
        }
        @media (max-width: 600px) {
          .portals-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header style={s.header}>
        <nav style={s.nav}>
          <Link to="/" style={s.logo}>
            <div style={s.logoMark}>
              <img src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg" alt="BikeAI" style={s.logoImg} />
            </div>
            <div>
              <div style={s.logoText}>Bike<span style={{ color: '#FFD600' }}>AI</span></div>
              <div style={s.logoBadge}>Partner Platform</div>
            </div>
          </Link>

          <div style={s.navLinks} className="hide-mob">
            <a href="#portals" style={s.navLink} className="nav-link">Portals</a>
            <a href="#benefits" style={s.navLink} className="nav-link">Benefits</a>
            <a href="#features" style={s.navLink} className="nav-link">Features</a>
            <a href="#testimonials" style={s.navLink} className="nav-link">Partners</a>
            <Link to="/" style={s.navLink} className="nav-link">Customer App</Link>
          </div>

          <div style={s.navActions}>
            <Link to="/dealer/auth" style={s.navLogin} className="hide-mob">Dealer Login</Link>
            <Link to="/dealer/auth?tab=register" style={s.navCta} className="cta-primary">Become a Partner</Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroGlow1} />
        <div style={s.heroGlow2} />
        <div style={s.heroContent}>
          <div style={s.heroBadge}>
            <span style={s.badgeDot} />
            <Zap size={11} color="#FFD600" />
            1,200+ Workshops · ₹0 Setup · Go Live in 24hrs
          </div>
          <h1 style={s.heroH1}>
            The Complete<br />
            <span style={{ color: '#FFD600' }}>Workshop Operating System</span>
          </h1>
          <p style={s.heroSub}>
            From customer booking to delivery — manage your entire workshop digitally.
            Dealer, CRM, Service Manager, and Admin platforms in one ecosystem.
          </p>
          <div style={s.heroCtas}>
            <Link to="/dealer/auth?tab=register" style={s.ctaPrimary} className="cta-primary">
              Get Started Free <ArrowRight size={15} />
            </Link>
            <Link to="/dealer/auth" style={s.ctaDark} className="cta-dark">
              Dealer Login
            </Link>
          </div>
          <div style={s.heroPills}>
            {['Free Onboarding', 'No Setup Cost', 'Go Live in 24hrs', '24/7 Support'].map(p => (
              <span key={p} style={s.pill}><CheckCircle size={11} color="#FFD600" />{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div style={s.statsRow}>
        {STATS.map(stat => (
          <div key={stat.label} style={s.statItem}>
            <span style={s.statVal}>{stat.value}</span>
            <span style={s.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ── OPERATIONAL PORTALS ── */}
      <section id="portals" style={{ ...s.section, background: '#0B1F4D' }}>
        <div style={s.sectionHead}>
          <span style={{ ...s.eyebrow, color: '#FFD600', borderColor: 'rgba(255,214,0,0.3)', background: 'rgba(255,214,0,0.08)' }}>Role-Based Access</span>
          <h2 style={{ ...s.sectionTitle, color: 'white' }}>One Ecosystem, Four Portals</h2>
          <p style={{ ...s.sectionSub, color: 'rgba(255,255,255,0.55)' }}>
            Each role gets its own dedicated dashboard, AI assistant, and operational context — not a shared generic tool.
          </p>
        </div>

        <div style={s.portalsGrid} className="portals-grid">
          {PORTALS.map(portal => (
            <div key={portal.id} style={{ ...s.portalCard, background: portal.bg }} className="portal-card">
              {/* Portal header */}
              <div style={s.portalTopRow}>
                <div style={{ ...s.portalIconWrap, background: portal.color + '22', border: `1px solid ${portal.color}44` }}>
                  <portal.Icon size={20} color={portal.color} />
                </div>
                <div style={{ ...s.portalRoleBadge, background: portal.color + '22', color: portal.color, border: `1px solid ${portal.color}44` }}>
                  {portal.subtitle}
                </div>
              </div>

              <h3 style={s.portalTitle}>{portal.title}</h3>
              <p style={s.portalDesc}>{portal.desc}</p>

              {/* Feature tags */}
              <div style={s.portalFeatures}>
                {portal.features.map(f => (
                  <span key={f} style={{ ...s.portalFeatureChip, borderColor: portal.color + '35', color: 'rgba(255,255,255,0.65)' }}>
                    {f}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div style={s.portalActions}>
                <Link
                  to={portal.loginPath}
                  style={{ ...s.portalLoginBtn, background: portal.color, color: portal.id === 'dealer' ? '#0B1F4D' : 'white' }}
                  className="portal-login"
                >
                  <LogIn size={13} /> Sign In
                </Link>
                {portal.id !== 'admin' && (
                  <Link to={portal.registerPath} style={s.portalRegisterLink}>
                    Become a Partner <ChevronRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section id="benefits" style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.eyebrow}>Platform Benefits</span>
          <h2 style={s.sectionTitle}>Everything Your Workshop Needs</h2>
          <p style={s.sectionSub}>A complete operational suite built for Indian two-wheeler workshops.</p>
        </div>
        <div style={s.benefitsGrid} className="benefits-grid">
          {BENEFITS.map(b => (
            <div key={b.title} style={s.benefitCard} className="benefit-card">
              <div style={{ ...s.benefitIcon, background: b.color + '15' }}>
                <b.icon size={22} color={b.color} />
              </div>
              <h3 style={s.benefitTitle}>{b.title}</h3>
              <p style={s.benefitDesc}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ ...s.section, background: '#f8faff' }}>
        <div style={s.sectionHead}>
          <span style={s.eyebrow}>Dashboard Modules</span>
          <h2 style={s.sectionTitle}>Built for Real Workshop Operations</h2>
        </div>
        <div style={s.planCols}>
          <div style={s.planLeft}>
            <p style={s.planSub}>
              BikeAI isn't a booking form — it's a complete mobility operating system.
              Every module is purpose-built for the Indian two-wheeler workshop workflow.
            </p>
            <div style={s.planFeatures}>
              {[
                { Icon: LayoutDashboard, label: 'Live Dashboard', desc: 'Real-time workshop overview' },
                { Icon: Wrench, label: 'Service Queue', desc: 'Digital job card management' },
                { Icon: MessageSquare, label: 'CRM', desc: 'WhatsApp campaigns & reminders' },
                { Icon: Truck, label: 'Pickup & Drop', desc: 'Rider dispatch & tracking' },
                { Icon: Package, label: 'Inventory', desc: 'Parts stock & reorder alerts' },
                { Icon: BarChart2, label: 'Analytics', desc: 'Revenue & productivity reports' },
                { Icon: Bell, label: 'Notifications', desc: 'Automated customer updates' },
                { Icon: UserCheck, label: 'Technicians', desc: 'Assignments & performance' },
                { Icon: MapPin, label: 'Vehicles', desc: 'Customer vehicle database' },
                { Icon: Star, label: 'Reviews', desc: 'Feedback & NPS tracking' },
              ].map(f => (
                <div key={f.label} style={s.featureItem} className="feature-item">
                  <div style={s.featureItemIcon}><f.Icon size={14} color="#FFD600" /></div>
                  <div>
                    <div style={s.featureItemLabel}>{f.label}</div>
                    <div style={s.featureItemDesc}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={s.planCard}>
            <div style={s.planCardBadge}>Partner Plan</div>
            <div style={s.planCardPrice}>₹0</div>
            <div style={s.planCardPeriod}>to get started</div>
            <div style={s.planCardSub}>No credit card. No hidden fees.</div>
            <Link to="/dealer/auth?tab=register" style={s.planCta} className="cta-primary">
              Start Free Today <ArrowRight size={14} />
            </Link>
            <Link to="/dealer/auth" style={s.planLoginLink}>Already a partner? Sign in →</Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" style={{ ...s.section, background: '#0B1F4D' }}>
        <div style={s.sectionHead}>
          <span style={{ ...s.eyebrow, color: '#FFD600', borderColor: 'rgba(255,214,0,0.3)', background: 'rgba(255,214,0,0.08)' }}>Partner Stories</span>
          <h2 style={{ ...s.sectionTitle, color: 'white' }}>Trusted by 1,200+ Workshops</h2>
        </div>
        <div style={s.testimonialsGrid} className="testimonials-grid">
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={s.testimonialCard}>
              <div style={s.testimonialStars}>{Array(t.rating).fill(null).map((_, i) => <Star key={i} size={13} fill="#FFD600" color="#FFD600" />)}</div>
              <p style={s.testimonialText}>"{t.text}"</p>
              <div style={s.testimonialAuthor}>
                <div style={s.testimonialAvatar}>{t.name[0]}</div>
                <div>
                  <div style={s.testimonialName}>{t.name}</div>
                  <div style={s.testimonialRole}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={s.finalCta}>
        <div style={s.finalCtaInner}>
          <h2 style={s.finalCtaTitle}>Ready to Grow Your Workshop?</h2>
          <p style={s.finalCtaSub}>Join 1,200+ partners already using BikeAI. Free to start, scales as you grow.</p>
          <div style={s.finalCtaActions}>
            <Link to="/dealer/auth?tab=register" style={s.ctaPrimary} className="cta-primary">
              Get Started Free <ArrowRight size={15} />
            </Link>
            <Link to="/dealer/auth" style={{ ...s.ctaDark, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }} className="cta-outline">
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div>
            <Link to="/" style={s.logo}>
              <div style={s.logoMark}><img src="/WhatsApp_Image_2026-04-13_at_5.47.15_PM.jpeg" alt="BikeAI" style={s.logoImg} /></div>
              <span style={{ ...s.logoText, fontSize: '16px' }}>Bike<span style={{ color: '#FFD600' }}>AI</span></span>
            </Link>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '12px', maxWidth: '220px', lineHeight: '1.6' }}>
              India's intelligent two-wheeler service platform.
            </p>
          </div>
          <div style={s.footerCols} className="footer-cols">
            {[
              { heading: 'Portals', links: [{ label: 'Dealer Dashboard', to: '/dealer/auth' }, { label: 'CRM Dashboard', to: '/dealer/auth?role=crm' }, { label: 'Service Manager', to: '/dealer/auth?role=service_manager' }, { label: 'Admin', to: '/login' }] },
              { heading: 'Customer', links: [{ label: 'Customer App', to: '/' }, { label: 'Book Service', to: '/my/book' }, { label: 'Track Repair', to: '/my/bookings' }, { label: 'Support', to: '/my/support' }] },
              { heading: 'Partner', links: [{ label: 'Become a Partner', to: '/dealer/auth?tab=register' }, { label: 'Request Demo', to: '/dealer/auth?tab=register' }, { label: 'Partner Benefits', to: '#benefits' }, { label: 'Contact Us', to: '#' }] },
            ].map(col => (
              <div key={col.heading}>
                <div style={s.footerHead}>{col.heading}</div>
                {col.links.map(l => (
                  l.to.startsWith('#')
                    ? <a key={l.label} href={l.to} style={s.footerLink} className="footer-link">{l.label}</a>
                    : <Link key={l.label} to={l.to} style={s.footerLink} className="footer-link">{l.label}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={s.footerBottom}>© 2026 BikeAI. All rights reserved.</div>
      </footer>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: 'white', fontFamily: '"Inter", system-ui, -apple-system, sans-serif', color: '#111827' },

  // Nav
  header: { position: 'sticky', top: 0, zIndex: 100, background: 'rgba(11,31,77,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  nav: { maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 },
  logoMark: { width: '34px', height: '34px', borderRadius: '9px', overflow: 'hidden', border: '1.5px solid rgba(255,214,0,0.3)' },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  logoText: { fontSize: '18px', fontWeight: '800', color: 'white', letterSpacing: '-0.2px' },
  logoBadge: { fontSize: '9px', fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginTop: '1px' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'center' },
  navLink: { fontSize: '13.5px', fontWeight: '500', color: 'rgba(255,255,255,0.7)', transition: 'color 0.15s' },
  navActions: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  navLogin: { fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', transition: 'all 0.15s' },
  navCta: { fontSize: '13px', fontWeight: '700', color: '#0B1F4D', background: '#FFD600', padding: '8px 16px', borderRadius: '8px', transition: 'all 0.15s' },

  // Hero
  hero: { background: 'linear-gradient(150deg, #060d1f 0%, #0B1F4D 50%, #0a2a5c 100%)', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden', textAlign: 'center' },
  heroGlow1: { position: 'absolute', top: '-80px', left: '15%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,0,0.1) 0%, transparent 70%)', pointerEvents: 'none' },
  heroGlow2: { position: 'absolute', bottom: '-60px', right: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' },
  heroContent: { position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.25)', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  badgeDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite', display: 'inline-block' },
  heroH1: { fontSize: '42px', fontWeight: '900', color: 'white', margin: 0, lineHeight: 1.15, letterSpacing: '-0.5px' },
  heroSub: { fontSize: '16px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: 0, maxWidth: '520px' },
  heroCtas: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 24px', background: '#FFD600', color: '#0B1F4D', borderRadius: '10px', fontWeight: '800', fontSize: '14px', transition: 'all 0.18s' },
  ctaDark: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 24px', background: '#132B63', color: 'white', borderRadius: '10px', fontWeight: '700', fontSize: '14px', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.18s' },
  heroPills: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' },
  pill: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Stats
  statsRow: { background: '#f8faff', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0', borderBottom: '1px solid #eaecf5' },
  statItem: { flex: '1 1 160px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', borderRight: '1px solid #eaecf5' },
  statVal: { fontSize: '28px', fontWeight: '900', color: '#0B1F4D', letterSpacing: '-0.5px' },
  statLabel: { fontSize: '12px', color: '#6B7280', fontWeight: '500', marginTop: '3px' },

  // Sections
  section: { padding: '72px 24px', background: 'white' },
  sectionHead: { maxWidth: '580px', margin: '0 auto 48px', textAlign: 'center' },
  eyebrow: { display: 'inline-block', padding: '4px 12px', background: '#f0f4ff', border: '1px solid #c7d7ff', borderRadius: '20px', fontSize: '11.5px', fontWeight: '700', color: '#3B5BDB', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: '12px' },
  sectionTitle: { fontSize: '30px', fontWeight: '900', color: '#0B1F4D', margin: '0 0 12px', letterSpacing: '-0.3px' },
  sectionSub: { fontSize: '15px', color: '#6B7280', lineHeight: '1.65', margin: 0 },

  // Portals grid
  portalsGrid: { maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  portalCard: { borderRadius: '18px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '12px' },
  portalTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  portalIconWrap: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  portalRoleBadge: { fontSize: '10px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', letterSpacing: '0.03em', textTransform: 'uppercase' as const },
  portalTitle: { fontSize: '17px', fontWeight: '800', color: 'white', margin: 0, letterSpacing: '-0.2px' },
  portalDesc: { fontSize: '12.5px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.55', margin: 0, flex: 1 },
  portalFeatures: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  portalFeatureChip: { fontSize: '10.5px', fontWeight: '600', padding: '3px 8px', border: '1px solid', borderRadius: '6px' },
  portalActions: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' },
  portalLoginBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  portalRegisterLink: { fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.45)', display: 'inline-flex', alignItems: 'center', gap: '3px', transition: 'color 0.15s' },

  // Benefits
  benefitsGrid: { maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
  benefitCard: { background: 'white', border: '1.5px solid #eaecf5', borderRadius: '16px', padding: '24px', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(11,31,77,0.04)' },
  benefitIcon: { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' },
  benefitTitle: { fontSize: '15px', fontWeight: '700', color: '#0B1F4D', margin: '0 0 6px' },
  benefitDesc: { fontSize: '13px', color: '#6B7280', lineHeight: '1.6', margin: 0 },

  // Features
  planCols: { maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '48px', alignItems: 'flex-start', flexWrap: 'wrap' },
  planLeft: { flex: 1, minWidth: '280px' },
  planSub: { fontSize: '15px', color: '#4B5563', lineHeight: '1.7', margin: '0 0 24px' },
  planFeatures: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  featureItem: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: '1px solid #eaecf5', borderRadius: '10px', transition: 'all 0.15s', cursor: 'default' },
  featureItemIcon: { width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,214,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureItemLabel: { fontSize: '13px', fontWeight: '700', color: '#0B1F4D' },
  featureItemDesc: { fontSize: '11px', color: '#9CA3AF', marginTop: '2px' },
  planCard: { background: 'linear-gradient(135deg, #0B1F4D 0%, #1a3a6b 100%)', borderRadius: '20px', padding: '36px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center', minWidth: '240px', boxShadow: '0 20px 48px rgba(11,31,77,0.25)' },
  planCardBadge: { fontSize: '11px', fontWeight: '700', color: '#FFD600', background: 'rgba(255,214,0,0.12)', border: '1px solid rgba(255,214,0,0.25)', borderRadius: '20px', padding: '3px 12px', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  planCardPrice: { fontSize: '56px', fontWeight: '900', color: 'white', lineHeight: 1, letterSpacing: '-2px' },
  planCardPeriod: { fontSize: '14px', color: 'rgba(255,255,255,0.5)' },
  planCardSub: { fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' },
  planCta: { display: 'flex', alignItems: 'center', gap: '7px', padding: '13px 28px', background: '#FFD600', color: '#0B1F4D', borderRadius: '10px', fontWeight: '800', fontSize: '14px', transition: 'all 0.18s', width: '100%', justifyContent: 'center', marginTop: '8px' },
  planLoginLink: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', transition: 'color 0.15s' },

  // Testimonials
  testimonialsGrid: { maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
  testimonialCard: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  testimonialStars: { display: 'flex', gap: '3px' },
  testimonialText: { fontSize: '13.5px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.65', margin: 0, flex: 1 },
  testimonialAuthor: { display: 'flex', alignItems: 'center', gap: '10px' },
  testimonialAvatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,214,0,0.15)', border: '1.5px solid rgba(255,214,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#FFD600', flexShrink: 0 },
  testimonialName: { fontSize: '13px', fontWeight: '700', color: 'white' },
  testimonialRole: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' },

  // Final CTA
  finalCta: { background: 'linear-gradient(135deg, #0B1F4D, #1a3a6b)', padding: '80px 24px', textAlign: 'center' },
  finalCtaInner: { maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  finalCtaTitle: { fontSize: '32px', fontWeight: '900', color: 'white', margin: 0, letterSpacing: '-0.3px' },
  finalCtaSub: { fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', margin: 0 },
  finalCtaActions: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' },

  // Footer
  footer: { background: '#060d1f', padding: '48px 24px 24px' },
  footerInner: { maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '48px', flexWrap: 'wrap', paddingBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  footerCols: { flex: 1, display: 'flex', gap: '48px', flexWrap: 'wrap' },
  footerHead: { fontSize: '11.5px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '12px' },
  footerLink: { display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '8px', transition: 'color 0.15s' },
  footerBottom: { maxWidth: '1100px', margin: '20px auto 0', fontSize: '12px', color: 'rgba(255,255,255,0.2)' },
}
