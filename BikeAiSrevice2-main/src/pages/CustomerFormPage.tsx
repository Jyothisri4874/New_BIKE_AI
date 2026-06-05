import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, User, Phone, MapPin, Tag, MessageSquare } from 'lucide-react'
import { api, safeGet } from '../lib/api'

const TAGS = ['VIP', 'Fleet', 'Warranty', 'Insurance Due', 'Service Due', 'Regular', 'New Customer']

interface FormState {
  full_name: string
  phone: string
  whatsapp_number: string
  email: string
  city: string
  pincode: string
  customer_notes: string
  tags: string[]
  loyalty_points: number
}

const EMPTY: FormState = {
  full_name: '',
  phone: '',
  whatsapp_number: '',
  email: '',
  city: '',
  pincode: '',
  customer_notes: '',
  tags: [],
  loyalty_points: 0,
}

export default function CustomerFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      // TODO: Confirm backend endpoint for fetching a CRM customer by id.
      const data = await safeGet<any>(`/api/crm/customers/${encodeURIComponent(id)}`, null)
      if (data) {
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          whatsapp_number: data.whatsapp_number || '',
          email: data.email || '',
          city: data.city || '',
          pincode: data.pincode || '',
          customer_notes: data.customer_notes || '',
          tags: data.tags || [],
          loyalty_points: data.loyalty_points || 0,
        })
      }
      setLoading(false)
    })()
  }, [id])

  const set = (field: keyof FormState, value: string | string[] | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Full name is required'); return }
    if (!form.phone.trim()) { setError('Phone number is required'); return }
    setSaving(true)
    setError('')

    if (isEdit) {
      try {
        // TODO: Confirm backend endpoint for updating a CRM customer.
        await api.patch(`/api/crm/customers/${encodeURIComponent(id!)}`, {
          full_name: form.full_name,
          phone: form.phone,
          whatsapp_number: form.whatsapp_number || null,
          city: form.city || null,
          pincode: form.pincode || null,
          customer_notes: form.customer_notes || null,
          tags: form.tags,
          loyalty_points: form.loyalty_points,
        })
        navigate(`/customers/${id}`)
      } catch (e) {
        setError((e as Error).message)
        setSaving(false)
        return
      }
    } else {
      try {
        const uid = crypto.randomUUID()
        // TODO: Confirm backend endpoint for creating a new CRM customer + (optional) login credentials.
        await api.post('/api/crm/customers', {
          id: uid,
          full_name: form.full_name,
          phone: form.phone,
          whatsapp_number: form.whatsapp_number || null,
          email: form.email || `${form.phone}@customer.bikeai.local`,
          city: form.city || null,
          pincode: form.pincode || null,
          customer_notes: form.customer_notes || null,
          tags: form.tags,
          loyalty_points: 0,
          role: 'customer',
          is_active: true,
        })
        navigate(`/customers/${uid}`)
      } catch (e) {
        setError((e as Error).message)
        setSaving(false)
        return
      }
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #e2e6f0', borderTopColor: '#0f2044', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <button onClick={() => navigate(isEdit ? `/customers/${id}` : '/customers')} style={S.backBtn}>
          <ArrowLeft size={15} /> {isEdit ? 'Customer' : 'Customers'}
        </button>
        <h2 style={S.title}>{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
      </div>

      <form onSubmit={handleSubmit} style={S.form}>
        {error && (
          <div style={S.errorBanner}>{error}</div>
        )}

        <Section icon={<User size={15} color="#0f2044" />} title="Basic Information">
          <div style={S.row}>
            <Field label="Full Name *" style={{ flex: 2, minWidth: '200px' }}>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Customer full name" style={S.input} />
            </Field>
            <Field label="Phone *" style={{ flex: 1, minWidth: '150px' }}>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" style={S.input} />
            </Field>
          </div>
          <div style={S.row}>
            <Field label="WhatsApp Number" style={{ flex: 1, minWidth: '150px' }}>
              <div style={{ position: 'relative' }}>
                <MessageSquare size={13} color="#9aa3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} placeholder="If different from phone" style={{ ...S.input, paddingLeft: '32px' }} />
              </div>
            </Field>
            <Field label="Email" style={{ flex: 1, minWidth: '200px' }}>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@email.com" style={S.input} disabled={isEdit} />
            </Field>
          </div>
        </Section>

        <Section icon={<MapPin size={15} color="#0f2044" />} title="Location">
          <div style={S.row}>
            <Field label="City" style={{ flex: 1 }}>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" style={S.input} />
            </Field>
            <Field label="Pincode" style={{ flex: 1 }}>
              <input value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="PIN code" style={S.input} maxLength={6} />
            </Field>
          </div>
        </Section>

        <Section icon={<Tag size={15} color="#0f2044" />} title="Tags">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  ...S.tagBtn,
                  background: form.tags.includes(tag) ? '#0f2044' : 'white',
                  color: form.tags.includes(tag) ? 'white' : '#6b7595',
                  border: form.tags.includes(tag) ? '1px solid #0f2044' : '1px solid #e2e6f0',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={<Phone size={15} color="#0f2044" />} title="Notes">
          <textarea
            value={form.customer_notes}
            onChange={e => set('customer_notes', e.target.value)}
            placeholder="Internal notes about this customer..."
            style={S.textarea}
            rows={4}
          />
        </Section>

        {isEdit && (
          <Section icon={<Tag size={15} color="#0f2044" />} title="Loyalty Points">
            <Field label="Points balance">
              <input type="number" value={form.loyalty_points} onChange={e => set('loyalty_points', parseInt(e.target.value) || 0)} style={{ ...S.input, maxWidth: '160px' }} min={0} />
            </Field>
          </Section>
        )}

        <div style={S.actions}>
          <button type="button" onClick={() => navigate(isEdit ? `/customers/${id}` : '/customers')} style={S.cancelBtn}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>
        {icon}
        <span style={S.sectionTitle}>{title}</span>
      </div>
      <div style={S.sectionBody}>{children}</div>
    </div>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' },
  topBar: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  title: { fontSize: '20px', fontWeight: '800', color: '#0f2044', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  errorBanner: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13.5px' },
  section: { background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', overflow: 'hidden' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 18px', borderBottom: '1px solid #f1f3f8', background: '#fafbfd' },
  sectionTitle: { fontSize: '13.5px', fontWeight: '700', color: '#0f2044' },
  sectionBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  label: { fontSize: '12px', fontWeight: '600', color: '#6b7595' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e6f0', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#0f2044', background: 'white', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  tagBtn: { padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  actions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' },
  cancelBtn: { padding: '10px 20px', background: 'white', border: '1px solid #e2e6f0', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', color: '#6b7595', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', background: '#0f2044', border: 'none', borderRadius: '9px', fontSize: '13.5px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'inherit' },
}
