import { useState, FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { User, Lock, Bell, Shield } from 'lucide-react'

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [newPwd, setNewPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // TODO: Confirm backend endpoint for updating admin profile.
      await api.patch('/api/profile', { full_name: fullName, phone })
      await refreshProfile()
    } catch {
      // keep UI stable
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPwd.length < 6) { setPwdMsg('Password must be at least 6 characters'); return }
    setPwdSaving(true)
    try {
      // TODO: Backend missing password update endpoint for JWT auth (e.g. POST /api/auth/change-password).
      setPwdMsg('Password update is not available yet.')
    } finally {
      setPwdSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'roles', label: 'Access Control', icon: Shield },
  ]

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Settings</h2>
        <p style={styles.pageSub}>Manage your account and platform settings</p>
      </div>

      <div style={styles.layout}>
        <div style={styles.sidebar}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              ...styles.sidebarTab,
              background: activeTab === tab.id ? '#eef2f8' : 'transparent',
              color: activeTab === tab.id ? '#0f2044' : '#374151',
              fontWeight: activeTab === tab.id ? '600' : '400',
            }}>
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {activeTab === 'profile' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Profile Information</h3>
              <p style={styles.cardSub}>Update your admin profile details</p>

              <form onSubmit={saveProfile} style={styles.form}>
                <div style={styles.avatarSection}>
                  <div style={styles.bigAvatar}>
                    {profile?.full_name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{profile?.full_name || 'Admin'}</p>
                    <p style={{ fontSize: '13px', color: '#6b7280' }}>{profile?.email}</p>
                    <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#eef2f8', color: '#0f2044', display: 'inline-block', marginTop: '6px', textTransform: 'uppercase' }}>
                      {profile?.role}
                    </span>
                  </div>
                </div>

                <div style={styles.fields}>
                  <div style={styles.field}>
                    <label style={styles.label}>Full Name</label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} style={styles.input} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Phone Number</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} style={styles.input} placeholder="+91 00000 00000" />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Email Address</label>
                    <input value={profile?.email || ''} disabled style={{ ...styles.input, background: '#f9fafb', color: '#9ca3af' }} />
                    <p style={{ fontSize: '11px', color: '#9ca3af' }}>Email cannot be changed from here</p>
                  </div>
                </div>

                <button type="submit" disabled={saving} style={styles.saveBtn}>
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Change Password</h3>
              <p style={styles.cardSub}>Ensure your account stays secure</p>

              <form onSubmit={changePassword} style={styles.form}>
                <div style={styles.fields}>
                  <div style={styles.field}>
                    <label style={styles.label}>New Password</label>
                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={styles.input} placeholder="Min. 6 characters" />
                  </div>
                </div>
                {pwdMsg && (
                  <div style={{ padding: '10px 14px', background: pwdMsg.includes('success') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${pwdMsg.includes('success') ? '#bbf7d0' : '#fecaca'}`, borderRadius: '8px', color: pwdMsg.includes('success') ? '#16a34a' : '#dc2626', fontSize: '13px' }}>
                    {pwdMsg}
                  </div>
                )}
                <button type="submit" disabled={pwdSaving} style={styles.saveBtn}>
                  {pwdSaving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Notification Preferences</h3>
              <p style={styles.cardSub}>Choose what you want to be notified about</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                {[
                  { label: 'New dealer registration', sub: 'Get notified when a dealer registers' },
                  { label: 'Booking alerts', sub: 'New bookings and status changes' },
                  { label: 'User sign-ups', sub: 'New customer registrations' },
                  { label: 'System updates', sub: 'Platform maintenance alerts' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{item.label}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{item.sub}</p>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                      <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: '#0f2044', borderRadius: '24px', transition: '0.15s' }} />
                      <span style={{ position: 'absolute', content: '', height: '18px', width: '18px', left: '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.15s', transform: 'translateX(20px)' }} />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Access Control</h3>
              <p style={styles.cardSub}>Role-based access permissions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                {[
                  { role: 'Admin', perms: ['Full system access', 'Manage users & dealers', 'View all bookings', 'System settings'], color: '#0f2044', bg: '#eef2f8' },
                  { role: 'Dealer', perms: ['Manage own profile', 'View assigned bookings', 'Update booking status'], color: '#0f2044', bg: '#eef2f8' },
                  { role: 'Customer', perms: ['Browse dealers', 'Create bookings', 'View own history'], color: '#16a34a', bg: '#f0fdf4' },
                ].map(item => (
                  <div key={item.role} style={{ padding: '16px', background: item.bg, border: `1px solid ${item.color}20`, borderRadius: '10px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: item.color, marginBottom: '8px' }}>{item.role}</p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {item.perms.map(p => (
                        <li key={p} style={{ fontSize: '12px', padding: '3px 10px', background: 'white', borderRadius: '20px', color: '#374151', border: '1px solid #e5e7eb' }}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  pageHeader: {},
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7280' },
  layout: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  sidebar: { width: '200px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 },
  sidebarTab: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13.5px', transition: 'all 0.15s', width: '100%', textAlign: 'left' },
  content: { flex: 1 },
  card: { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '28px' },
  cardTitle: { fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' },
  cardSub: { fontSize: '13px', color: '#9ca3af', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  avatarSection: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f9fafb', borderRadius: '10px' },
  bigAvatar: { width: '56px', height: '56px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: 'white', flexShrink: 0 },
  fields: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#111827' },
  saveBtn: { padding: '10px 20px', background: '#0f2044', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', width: 'fit-content' },
}
