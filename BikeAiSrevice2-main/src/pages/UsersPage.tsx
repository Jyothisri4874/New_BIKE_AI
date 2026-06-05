import { useEffect, useState } from 'react'
import { api, safeGet } from '../lib/api'
import { Profile, UserRole } from '../types'
import { Search, UserCheck, UserX, Shield } from 'lucide-react'

const ROLE_TABS: { label: string; value: UserRole | 'all' }[] = [
  { label: 'All Users', value: 'all' },
  { label: 'Customers', value: 'customer' },
  { label: 'Dealers', value: 'dealer' },
  { label: 'Admins', value: 'admin' },
]

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [filtered, setFiltered] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  const loadUsers = async () => {
    setLoading(true)
    // TODO: Confirm backend endpoint for admin user list.
    const data = await safeGet<Profile[]>('/api/users', [])
    setUsers((data || []) as Profile[])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    let list = users
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      )
    }
    setFiltered(list)
  }, [users, search, roleFilter])

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      // TODO: Confirm backend endpoint for updating a user.
      await api.patch(`/api/users/${id}`, { is_active: !is_active })
    } catch {
      // keep UI responsive even if endpoint is missing
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !is_active } : u))
  }

  const changeRole = async (id: string, role: UserRole) => {
    try {
      // TODO: Confirm backend endpoint for updating a user's role.
      await api.patch(`/api/users/${id}`, { role })
    } catch {
      // keep UI responsive even if endpoint is missing
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>User Management</h2>
          <p style={styles.pageSub}>{users.length} total users registered</p>
        </div>
      </div>

      <div style={styles.tabs}>
        {ROLE_TABS.map(tab => (
          <button key={tab.value} onClick={() => setRoleFilter(tab.value)} style={{
            ...styles.tab,
            background: roleFilter === tab.value ? '#0f2044' : 'transparent',
            color: roleFilter === tab.value ? 'white' : '#6b7280',
            border: roleFilter === tab.value ? '1px solid #0f2044' : '1px solid #e5e7eb',
          }}>
            {tab.label}
            <span style={{ ...styles.tabCount, background: roleFilter === tab.value ? 'rgba(255,255,255,0.2)' : '#f3f4f6', color: roleFilter === tab.value ? 'white' : '#6b7280' }}>
              {tab.value === 'all' ? users.length : users.filter(u => u.role === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      <div style={styles.searchBar}>
        <div style={styles.searchWrap}>
          <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." style={styles.searchInput} />
        </div>
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.loadState}>
            <div style={styles.spinner} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '40px' }}>👥</span>
            <p>No users found</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['User', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.userCell}>
                      <div style={styles.userAvatar}>{user.full_name?.[0]?.toUpperCase() || 'U'}</div>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{user.full_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{user.email || '—'}</td>
                  <td style={styles.td}>{user.phone || '—'}</td>
                  <td style={styles.td}>
                    <select
                      value={user.role}
                      onChange={e => changeRole(user.id, e.target.value as UserRole)}
                      style={styles.roleSelect}
                    >
                      <option value="customer">Customer</option>
                      <option value="dealer">Dealer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: user.is_active ? '#f0fdf4' : '#fef2f2', color: user.is_active ? '#16a34a' : '#dc2626' }}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(user.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {user.role !== 'admin' && (
                        <button onClick={() => changeRole(user.id, 'admin')} title="Make Admin" style={styles.actionBtn}>
                          <Shield size={14} color="#7c3aed" />
                        </button>
                      )}
                      <button onClick={() => toggleActive(user.id, user.is_active)} title={user.is_active ? 'Deactivate' : 'Activate'} style={styles.actionBtn}>
                        {user.is_active ? <UserX size={14} color="#dc2626" /> : <UserCheck size={14} color="#16a34a" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  pageTitle: { fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' },
  pageSub: { fontSize: '13px', color: '#6b7280' },
  tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s' },
  tabCount: { padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
  searchBar: { display: 'flex', gap: '10px' },
  searchWrap: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', color: '#374151', background: 'white' },
  tableCard: { background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '14px 20px', fontSize: '13.5px', color: '#374151' },
  userCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '32px', height: '32px', background: 'linear-gradient(135deg, #eef2f8, #dce3f0)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#0f2044', flexShrink: 0 },
  roleSelect: { padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', color: '#374151', background: 'white', cursor: 'pointer', outline: 'none' },
  actionBtn: { width: '30px', height: '30px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  loadState: { display: 'flex', justifyContent: 'center', padding: '48px' },
  spinner: { width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  emptyState: { padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#9ca3af' },
}
