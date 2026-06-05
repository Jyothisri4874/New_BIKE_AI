import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  trend?: number
  accent?: boolean
  onClick?: () => void
}

export default function KPICard({ label, value, sub, icon: Icon, iconColor, iconBg, trend, accent, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: accent ? 'linear-gradient(135deg, #0f2044, #1a3566)' : 'white',
        border: `1px solid ${accent ? 'transparent' : '#e2e6f0'}`,
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {accent && (
        <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(245,224,25,0.08)' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={iconColor} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: '11px', fontWeight: '600', color: trend >= 0 ? '#16a34a' : '#dc2626', background: trend >= 0 ? '#f0fdf4' : '#fef2f2', padding: '2px 7px', borderRadius: '10px' }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: accent ? 'white' : '#0f2044', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: accent ? 'rgba(255,255,255,0.8)' : '#6b7595', marginTop: '3px' }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: accent ? 'rgba(255,255,255,0.45)' : '#9aa3b8', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  )
}
