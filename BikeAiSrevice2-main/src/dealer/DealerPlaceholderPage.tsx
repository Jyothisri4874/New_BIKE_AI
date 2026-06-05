import { type LucideIcon, Wrench } from 'lucide-react'

interface Props {
  title: string
  description: string
  icon?: LucideIcon
  color?: string
}

export default function DealerPlaceholderPage({ title, description, icon: Icon = Wrench, color = '#FFD600' }: Props) {
  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={{ ...s.iconBox, background: color + '15' }}>
          <Icon size={32} color={color} />
        </div>
        <h2 style={s.title}>{title}</h2>
        <p style={s.desc}>{description}</p>
        <div style={s.comingSoon}>Coming Soon</div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  card: { background: 'white', border: '1.5px solid #eaecf5', borderRadius: '20px', padding: '48px 40px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 2px 12px rgba(11,31,77,0.06)' },
  iconBox: { width: '72px', height: '72px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  title: { fontSize: '22px', fontWeight: '900', color: '#0B1F4D', margin: '0 0 10px', letterSpacing: '-0.3px' },
  desc: { fontSize: '14px', color: '#6B7280', lineHeight: '1.6', margin: '0 0 24px' },
  comingSoon: { display: 'inline-block', padding: '6px 16px', background: 'rgba(255,214,0,0.12)', border: '1px solid rgba(255,214,0,0.3)', borderRadius: '20px', fontSize: '12px', fontWeight: '700', color: '#92690a' },
}
