const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  pending:       { bg: '#fffbeb', color: '#d97706' },
  confirmed:     { bg: '#eef2f8', color: '#0f2044' },
  in_progress:   { bg: '#f0f9ff', color: '#0284c7' },
  completed:     { bg: '#f0fdf4', color: '#16a34a' },
  cancelled:     { bg: '#fef2f2', color: '#dc2626' },
  active:        { bg: '#f0fdf4', color: '#16a34a' },
  suspended:     { bg: '#fef2f2', color: '#dc2626' },
  open:          { bg: '#f0f9ff', color: '#0284c7' },
  delivered:     { bg: '#f0fdf4', color: '#16a34a' },
  draft:         { bg: '#f9fafb', color: '#6b7280' },
  paid:          { bg: '#f0fdf4', color: '#16a34a' },
  overdue:       { bg: '#fef2f2', color: '#dc2626' },
  breakdown:     { bg: '#fef2f2', color: '#dc2626' },
  high:          { bg: '#fef2f2', color: '#dc2626' },
  low:           { bg: '#f0fdf4', color: '#16a34a' },
  normal:        { bg: '#eef2f8', color: '#0f2044' },
  contacted:     { bg: '#f0fdf4', color: '#16a34a' },
  not_reachable: { bg: '#fef2f2', color: '#dc2626' },
  booked:        { bg: '#eef2f8', color: '#0f2044' },
  closed:        { bg: '#f9fafb', color: '#6b7280' },
}

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      background: s.bg,
      color: s.color,
      textTransform: 'capitalize',
    }}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}
