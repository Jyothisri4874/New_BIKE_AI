import { useState, FormEvent } from 'react'
import { useCustomerAuth } from '../hooks/useCustomerAuth'
import { api } from '../lib/api'
import { User, Phone, Mail, Shield, Bell, Save, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CustomerSettingsPage() {
  const { user, profile, signOut, refreshProfile } = useCustomerAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // TODO: Confirm backend endpoint for updating current customer's profile.
      await api.patch('/api/profile', { full_name: fullName, phone })
      await refreshProfile()
      setSuccess('Profile updated successfully!')
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/my/auth')
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>Settings</h1>
        <p style={s.sub}>Manage your account and preferences</p>
      </div>

      <div style={s.grid}>
        {/* Profile */}
        <form onSubmit={handleSave} style={s.card}>
          <div style={s.cardHeader}><User size={18} color="#f5a623" /><h2 style={s.cardTitle}>Profile Information</h2></div>

          {error && <div style={s.errorBox}>{error}</div>}
          {success && <div style={s.successBox}>{success}</div>}

          <div style={s.field}>
            <label style={s.label}><User size={13} /> Full Name</label>
            <input style={s.input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div style={s.field}>
            <label style={s.label}><Phone size={13} /> Mobile Number</label>
            <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
          </div>
          <div style={s.field}>
            <label style={s.label}><Mail size={13} /> Email Address</label>
            <input style={{ ...s.input, background: '#f5f7fa', color: '#9aa3b8' }} value={user?.email || ''} disabled />
            <p style={s.hint}>Email cannot be changed</p>
          </div>
          <button type="submit" disabled={saving} style={s.saveBtn}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={s.card}>
            <div style={s.cardHeader}><Bell size={18} color="#f5a623" /><h2 style={s.cardTitle}>Notifications</h2></div>
            {[
              { label: 'Booking confirmations', defaultOn: true },
              { label: 'Service reminders', defaultOn: true },
              { label: 'Pickup notifications', defaultOn: true },
              { label: 'Promotional offers', defaultOn: false },
            ].map(item => (
              <div key={item.label} style={s.prefRow}>
                <span style={s.prefLabel}>{item.label}</span>
                <Toggle defaultOn={item.defaultOn} />
              </div>
            ))}
          </div>

          <div style={s.card}>
            <div style={s.cardHeader}><Shield size={18} color="#f5a623" /><h2 style={s.cardTitle}>Account</h2></div>
            <div style={s.accountInfo}>
              <p style={s.accountLabel}>Member since</p>
              <p style={s.accountValue}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
            </div>
            <button style={s.logoutBtn} onClick={handleSignOut}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      <style>{`input:focus,select:focus{outline:none!important;border-color:#f5a623!important;box-shadow:0 0 0 3px rgba(245,166,35,0.15)!important;}`}</style>
    </div>
  )
}

function Toggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button onClick={() => setOn(!on)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
      <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: on ? '#f5a623' : '#e2e6f0', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s', transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
      </div>
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '24px' },
  header: {},
  title: { fontSize: '24px', fontWeight: '800', color: '#0f2044', margin: '0 0 4px' },
  sub: { fontSize: '14px', color: '#9aa3b8', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' },
  card: { background: 'white', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '4px' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#0f2044', margin: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '600', color: '#555' },
  input: { padding: '10px 12px', border: '1.5px solid #e2e6f0', borderRadius: '9px', fontSize: '14px', color: '#0f2044', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  hint: { fontSize: '11px', color: '#9aa3b8', margin: 0 },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start' },
  errorBox: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' },
  successBox: { padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', fontSize: '13px' },
  prefRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' },
  prefLabel: { fontSize: '14px', color: '#333' },
  accountInfo: { display: 'flex', flexDirection: 'column', gap: '3px' },
  accountLabel: { fontSize: '12px', color: '#9aa3b8', margin: 0 },
  accountValue: { fontSize: '14px', fontWeight: '600', color: '#0f2044', margin: 0 },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start' },
}
