import React from 'react'

interface SectionCardProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  noPad?: boolean
  children: React.ReactNode
}

export default function SectionCard({ title, subtitle, action, noPad, children }: SectionCardProps) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e6f0', borderRadius: '12px', overflow: 'hidden' }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f1f3f8' }}>
          <div>
            {title && <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f2044' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: '12px', color: '#9aa3b8', marginTop: '2px' }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={noPad ? {} : { padding: '16px 18px' }}>
        {children}
      </div>
    </div>
  )
}
