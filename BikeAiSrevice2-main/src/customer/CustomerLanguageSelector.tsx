import { CUSTOMER_LANGUAGE_OPTIONS, getCustomerCopy, type CustomerLanguage } from '../lib/customerLanguage'

interface Props {
  value: CustomerLanguage
  onChange: (language: CustomerLanguage) => void
}

export default function CustomerLanguageSelector({ value, onChange }: Props) {
  const copy = getCustomerCopy(value)

  return (
    <label style={s.wrap}>
      <span style={s.label}>{copy.language}</span>
      <select
        aria-label="Customer language"
        value={value}
        onChange={event => onChange(event.target.value as CustomerLanguage)}
        style={s.select}
      >
        {CUSTOMER_LANGUAGE_OPTIONS.map(option => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: '6px' },
  label: { fontSize: '12px', color: '#64748b', fontWeight: 700 },
  select: {
    height: '34px',
    border: '1px solid #dbe3ef',
    borderRadius: '8px',
    background: 'white',
    color: '#0f2044',
    fontSize: '12px',
    fontWeight: 700,
    padding: '0 8px',
    outline: 'none',
  },
}
