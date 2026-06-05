import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CreditCard, Receipt, TrendingUp } from 'lucide-react'
import { safeGet } from '../lib/api'

interface Props {
  serviceCenterId: string | null
  compact?: boolean
}

interface Wallet {
  credit_balance: number
  low_balance_threshold: number
  status: string
}

interface Charge {
  id: string
  booking_id: string | null
  job_card_id: string | null
  customer_id: string | null
  charge_amount: number
  charge_status: string
  charged_at: string
}

interface Tx {
  id: string
  transaction_type: string
  amount: number
  balance_after: number
  notes: string | null
  created_at: string
}

export default function DealerRevenueWidgets({ serviceCenterId, compact = false }: Props) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])

  useEffect(() => {
    if (!serviceCenterId) return
    load(serviceCenterId)
  }, [serviceCenterId])

  const load = async (centerId: string) => {
    // TODO: Confirm backend endpoints for dealer wallet, charges, and transactions.
    const [walletRes, chargesRes, txRes] = await Promise.all([
      safeGet<Wallet | null>(`/api/dealer/wallet?serviceCenterId=${encodeURIComponent(centerId)}`, null),
      safeGet<Charge[]>(`/api/dealer/charges?serviceCenterId=${encodeURIComponent(centerId)}&limit=100`, []),
      safeGet<Tx[]>(`/api/dealer/wallet-transactions?serviceCenterId=${encodeURIComponent(centerId)}&limit=100`, []),
    ])
    setWallet(walletRes || { credit_balance: 0, low_balance_threshold: 600, status: 'low_balance' })
    setCharges((chargesRes || []) as Charge[])
    setTransactions((txRes || []) as Tx[])
  }

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const month = new Date(today.getFullYear(), today.getMonth(), 1)
    const charged = charges.filter(c => c.charge_status === 'charged')
    const todayCharges = charged.filter(c => new Date(c.charged_at) >= today)
    const mtdCharges = charged.filter(c => new Date(c.charged_at) >= month)
    return {
      todayCount: todayCharges.length,
      todayRevenue: todayCharges.reduce((sum, c) => sum + Number(c.charge_amount || 0), 0),
      mtdCount: mtdCharges.length,
      mtdRevenue: mtdCharges.reduce((sum, c) => sum + Number(c.charge_amount || 0), 0),
      lowBalance: wallet ? wallet.credit_balance <= wallet.low_balance_threshold : true,
    }
  }, [charges, wallet])

  if (!serviceCenterId) return null

  return (
    <section style={s.wrap}>
      <div style={s.kpiGrid}>
        <Card label="Today Chargeable" value={stats.todayCount} sub="successful BikeAI bookings" icon={<Receipt size={18} />} color="#2563eb" />
        <Card label="Today BikeAI Revenue" value={money(stats.todayRevenue)} sub="at INR 60 per booking" icon={<TrendingUp size={18} />} color="#059669" />
        <Card label="MTD Chargeable" value={stats.mtdCount} sub="month to date" icon={<Receipt size={18} />} color="#7c3aed" />
        <Card label="MTD BikeAI Revenue" value={money(stats.mtdRevenue)} sub="platform revenue" icon={<TrendingUp size={18} />} color="#d97706" />
        <Card label="Dealer Credit Balance" value={money(wallet?.credit_balance || 0)} sub={wallet?.status || 'low_balance'} icon={<CreditCard size={18} />} color={stats.lowBalance ? '#dc2626' : '#0f2044'} />
      </div>

      {stats.lowBalance && (
        <div style={s.warning}><AlertTriangle size={15} /> Low balance warning: please top up dealer wallet to avoid booking charge failures.</div>
      )}

      {!compact && (
        <div style={s.historyGrid}>
          <History title="Booking Charge History" rows={charges.map(c => ({
            id: c.id,
            left: c.booking_id ? `Booking ${c.booking_id.slice(0, 8)}` : 'Booking',
            right: money(c.charge_amount),
            meta: `${c.charge_status} - ${dateTime(c.charged_at)}`,
          }))} />
          <History title="Wallet Transaction History" rows={transactions.map(t => ({
            id: t.id,
            left: labelize(t.transaction_type),
            right: money(t.amount),
            meta: `Balance ${money(t.balance_after)} - ${dateTime(t.created_at)}`,
          }))} />
        </div>
      )}
    </section>
  )
}

function Card({ label, value, sub, icon, color }: { label: string; value: string | number; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <article style={s.card}>
      <div style={{ ...s.icon, background: `${color}16`, color }}>{icon}</div>
      <div>
        <div style={{ ...s.value, color }}>{value}</div>
        <div style={s.label}>{label}</div>
        <div style={s.sub}>{sub}</div>
      </div>
    </article>
  )
}

function History({ title, rows }: { title: string; rows: { id: string; left: string; right: string; meta: string }[] }) {
  return (
    <div style={s.historyCard}>
      <h3 style={s.historyTitle}>{title}</h3>
      {rows.length === 0 ? <p style={s.empty}>No records yet</p> : rows.slice(0, 8).map(row => (
        <div key={row.id} style={s.historyRow}>
          <div><strong>{row.left}</strong><span>{row.meta}</span></div>
          <b>{row.right}</b>
        </div>
      ))}
    </div>
  )
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'grid', gap: '12px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  card: { background: 'white', border: '1.5px solid #eaecf5', borderRadius: '14px', padding: '15px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(11,31,77,0.04)' },
  icon: { width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  value: { fontSize: '21px', fontWeight: 900, lineHeight: 1 },
  label: { fontSize: '12px', color: '#0B1F4D', fontWeight: 800, marginTop: '4px' },
  sub: { fontSize: '11px', color: '#9aa3b8', marginTop: '2px' },
  warning: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: '1px solid #fecaca', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px', fontWeight: 700 },
  historyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' },
  historyCard: { background: 'white', border: '1.5px solid #eaecf5', borderRadius: '14px', padding: '16px' },
  historyTitle: { margin: '0 0 10px', fontSize: '14px', color: '#0B1F4D' },
  historyRow: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12.5px', color: '#0B1F4D' },
  empty: { margin: 0, color: '#9aa3b8', fontSize: '13px' },
}
