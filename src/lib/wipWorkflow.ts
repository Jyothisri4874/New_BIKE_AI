import { api, safeGet } from './api'
import type {
  AddWipPhotoInput,
  AdvanceWipStatusInput,
  AssignWipTechnicianInput,
  CreateWipApprovalInput,
  CreateWipTrackingRecordInput,
  DealerStaff,
  TechnicianAssignment,
  WipApproval,
  WipCustomerTrackingPayload,
  WipPhoto,
  WipStatus,
  WipStatusHistory,
  WipTrackingRecord,
} from '../types/wip'

export const WIP_STATUS_FLOW: WipStatus[] = ['received', 'inspection', 'approval', 'repair', 'wash', 'qc', 'ready', 'delivered']

export const WIP_STATUS_COPY: Record<WipStatus, { label: string; description: string; color: string }> = {
  received: {
    label: 'Received',
    description: 'Vehicle received at workshop. Dealer DMS job card already exists.',
    color: '#2563EB',
  },
  inspection: {
    label: 'Inspection',
    description: 'Technician assigned and vehicle inspection started or completed.',
    color: '#F59E0B',
  },
  approval: {
    label: 'Approval',
    description: 'Additional work approval is pending, approved, or rejected.',
    color: '#DC2626',
  },
  repair: {
    label: 'Repair',
    description: 'Repair or service work is in progress.',
    color: '#7C3AED',
  },
  wash: {
    label: 'Wash',
    description: 'Vehicle is in washing queue or washing is completed.',
    color: '#0891B2',
  },
  qc: {
    label: 'QC',
    description: 'Quality check, road test, and final inspection.',
    color: '#EA580C',
  },
  ready: {
    label: 'Ready',
    description: 'Dealer DMS invoice generated and vehicle ready for delivery.',
    color: '#16A34A',
  },
  delivered: {
    label: 'Delivered',
    description: 'Vehicle handed over to customer and tracking closed.',
    color: '#334155',
  },
}

export interface WipModuleData {
  records: WipTrackingRecord[]
  history: WipStatusHistory[]
  approvals: WipApproval[]
  photos: WipPhoto[]
  staff: DealerStaff[]
  assignments: TechnicianAssignment[]
}

export function getWipStatusIndex(status: WipStatus) {
  return WIP_STATUS_FLOW.indexOf(status)
}

export function getNextWipStatus(status: WipStatus): WipStatus | null {
  const index = getWipStatusIndex(status)
  return index >= 0 && index < WIP_STATUS_FLOW.length - 1 ? WIP_STATUS_FLOW[index + 1] : null
}

export function canTransitionWipStatus(current: WipStatus, next: WipStatus) {
  const currentIndex = getWipStatusIndex(current)
  const nextIndex = getWipStatusIndex(next)
  return nextIndex >= 0 && (current === next || nextIndex === currentIndex + 1)
}

export function labelWipStatus(status: string) {
  const known = WIP_STATUS_COPY[status as WipStatus]
  if (known) return known.label
  return status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export function buildWipTrackingUrl(trackingCode: string, origin?: string) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://service.bikeai.in')
  return `${base.replace(/\/$/, '')}/service/track/${encodeURIComponent(trackingCode)}`
}

export function buildWipTrackingQrImageUrl(trackingUrl: string, size = 192) {
  const safeSize = Math.max(96, Math.min(size, 320))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${encodeURIComponent(trackingUrl)}`
}

export function isReadyBlocked(record: WipTrackingRecord, nextStatus: WipStatus | null) {
  return nextStatus === 'ready' && !record.dealer_dms_invoice_no && !record.invoice_generated_at
}

export function isRepairBlockedByApproval(record: WipTrackingRecord, approvals: WipApproval[], nextStatus: WipStatus | null) {
  return nextStatus === 'repair' && record.approval_state === 'pending' && approvals.some(item => item.status === 'pending')
}

export async function loadWipModuleData(serviceCenterId: string): Promise<WipModuleData> {
  const query = `serviceCenterId=${encodeURIComponent(serviceCenterId)}`
  const [records, history, approvals, photos, staff, assignments] = await Promise.all([
    safeGet<WipTrackingRecord[]>(`/api/wip/tracking-records?${query}`, []),
    safeGet<WipStatusHistory[]>(`/api/wip/status-history?${query}`, []),
    safeGet<WipApproval[]>(`/api/wip/approvals?${query}`, []),
    safeGet<WipPhoto[]>(`/api/wip/photos?${query}`, []),
    safeGet<DealerStaff[]>(`/api/wip/dealer-staff?${query}`, []),
    safeGet<TechnicianAssignment[]>(`/api/wip/technician-assignments?${query}`, []),
  ])

  return { records, history, approvals, photos, staff, assignments }
}

export function createWipTrackingRecord(input: CreateWipTrackingRecordInput) {
  return api.post<WipTrackingRecord>('/api/wip/tracking-records', input)
}

export function advanceWipStatus(input: AdvanceWipStatusInput) {
  return api.post<WipTrackingRecord>(`/api/wip/tracking-records/${encodeURIComponent(input.record_id)}/advance`, input)
}

export function createWipApproval(input: CreateWipApprovalInput) {
  return api.post<WipApproval>('/api/wip/approvals', input)
}

export function respondWipApproval(trackingCode: string, approvalId: string, status: 'approved' | 'rejected', note = '') {
  return api.post<{ ok: boolean; approval?: WipApproval; error?: string }>('/api/wip/approvals/respond', {
    tracking_code: trackingCode,
    approval_id: approvalId,
    status,
    note,
  })
}

export function addWipPhoto(input: AddWipPhotoInput) {
  return api.post<WipPhoto>('/api/wip/photos', input)
}

export function assignWipTechnician(input: AssignWipTechnicianInput) {
  return api.post<TechnicianAssignment>('/api/wip/technician-assignments', input)
}

export function queueWipWhatsAppNotification(recordId: string, eventType = 'manual_share') {
  return api.post<{ ok: boolean; notification_queue_id?: string }>('/api/wip/notifications/queue', {
    record_id: recordId,
    event_type: eventType,
  })
}

export function getWipCustomerTracking(trackingCode: string) {
  return api.post<WipCustomerTrackingPayload>('/api/wip/customer-tracking', { tracking_code: trackingCode })
}
