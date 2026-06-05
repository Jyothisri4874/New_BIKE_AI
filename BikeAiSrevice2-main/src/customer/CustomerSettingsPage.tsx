import { FormEvent, useEffect, useState } from 'react'
import { User, Phone, Mail, Shield, Bell, Save, LogOut } from 'lucide-react'
import { api, safeGet } from '../lib/api'
import { useCustomerAuth } from '../hooks/useCustomerAuth'

interface ProfileResponse {
  id?: string
  user_id?: string
  full_name?: string
  fullName?: string
  phone?: string
  email?: string
  role?: string
  created_at?: string
  createdAt?: string
}

export default function CustomerSettingsPage() {
  const { user, profile, signOut, refreshProfile } = useCustomerAuth()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [email, setEmail] = useState(user?.email || '')
  const [memberSince, setMemberSince] = useState(profile?.created_at || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      const data = await safeGet<ProfileResponse | null>('/api/profile', null)

      if (!data) {
        setFullName(profile?.full_name || '')
        setPhone(profile?.phone || '')
        setEmail(user?.email || '')
        setMemberSince(profile?.created_at || '')
        return
      }

      setFullName(data.full_name || data.fullName || '')
      setPhone(data.phone || '')
      setEmail(data.email || user?.email || '')
      setMemberSince(data.created_at || data.createdAt || '')
    }

    loadProfile()
  }, [profile, user])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    if (!fullName.trim()) {
      setError('Full name is required')
      setSaving(false)
      return
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      setSaving(false)
      return
    }

    try {
      const updated = await api.patch('/api/profile', {
        full_name: fullName.trim(),
        email: email.trim(),
      })

      const updatedData = updated as ProfileResponse

      setFullName(updatedData?.full_name || updatedData?.fullName || fullName.trim())
      setEmail(updatedData?.email || email.trim())
      setPhone(updatedData?.phone || phone)
      setSuccess('Profile updated successfully!')

      await refreshProfile()
    } catch (err) {
      setError((err as Error).message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const formattedMemberSince = memberSince
    ? new Date(memberSince).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <div style={s.root}>
      <div>
        <h1 style={s.title}>Settings</h1>
        <p style={s.sub}>Manage your account and preferences</p>
      </div>

      <div style={s.grid}>
        <form onSubmit={handleSave} style={s.card}>
          <div style={s.cardHeader}>
            <User size={18} color="#f5a623" />
            <h2 style={s.cardTitle}>Profile Information</h2>
          </div>

          {success && <div style={s.success}>{success}</div>}
          {error && <div style={s.error}>{error}</div>}

          <div style={s.field}>
            <label style={s.label}>
              <User size={13} />
              Full Name
            </label>
            <input
              style={s.input}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>
              <Phone size={13} />
              Mobile Number
            </label>
            <input
              style={{ ...s.input, background: '#f5f7fa', color: '#6b7280' }}
              value={phone}
              disabled
              placeholder="+91 98765 43210"
              type="tel"
            />
            <p style={s.hint}>Mobile number cannot be changed</p>
          </div>

          <div style={s.field}>
            <label style={s.label}>
              <Mail size={13} />
              Email Address
            </label>
            <input
              style={s.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
            <p style={s.hint}>Email can be updated</p>
          </div>

          <button type="submit" disabled={saving} style={s.saveBtn}>
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div style={s.side}>
          <div style={s.card}>
            <div style={s.cardHeader}>
              <Bell size={18} color="#f5a623" />
              <h2 style={s.cardTitle}>Notifications</h2>
            </div>

            <ToggleRow label="Booking confirmations" defaultChecked />
            <ToggleRow label="Service reminders" defaultChecked />
            <ToggleRow label="Pickup notifications" defaultChecked />
            <ToggleRow label="Promotional offers" />
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <Shield size={18} color="#f5a623" />
              <h2 style={s.cardTitle}>Account</h2>
            </div>

            <div style={s.accountInfo}>
              <span style={s.accountLabel}>Member since</span>
              <span style={s.accountValue}>{formattedMemberSince}</span>
            </div>

            <button type="button" onClick={signOut} style={s.signOutBtn}>
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  defaultChecked = false,
}: {
  label: string
  defaultChecked?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div style={s.toggleRow}>
      <span style={s.toggleLabel}>{label}</span>
      <button
        type="button"
        onClick={() => setChecked(!checked)}
        style={{
          ...s.toggle,
          background: checked ? '#f5a623' : '#e5e7eb',
        }}
      >
        <span
          style={{
            ...s.toggleKnob,
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '24px' },
  title: { fontSize: '24px', fontWeight: '800', color: '#0f2044', margin: '0 0 4px' },
  sub: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 0.85fr', gap: '20px' },
  side: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: { background: 'white', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#0f2044', margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' },
  label: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' },
  input: { width: '100%', padding: '12px 14px', border: '1.5px solid #e2e6f0', borderRadius: '10px', fontSize: '14px', color: '#0f2044', fontFamily: 'inherit', boxSizing: 'border-box' },
  hint: { fontSize: '11px', color: '#9aa3b8', margin: 0 },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start' },
  success: { padding: '10px 12px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '16px' },
  error: { padding: '10px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '16px' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' },
  toggleLabel: { fontSize: '14px', color: '#374151' },
  toggle: { width: '44px', height: '24px', borderRadius: '20px', border: 'none', padding: '2px', cursor: 'pointer', transition: 'background 0.2s' },
  toggleKnob: { display: 'block', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  accountInfo: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' },
  accountLabel: { fontSize: '12px', color: '#9aa3b8' },
  accountValue: { fontSize: '14px', fontWeight: '600', color: '#0f2044' },
  signOutBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}