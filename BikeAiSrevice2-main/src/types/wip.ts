export type WipStatus = 'received' | 'inspection' | 'approval' | 'repair' | 'wash' | 'qc' | 'ready' | 'delivered'

export type WipApprovalState = 'not_required' | 'pending' | 'approved' | 'rejected'

export type WipApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

export type DealerStaffRole =
  | 'dealer_admin'
  | 'service_advisor'
  | 'technician'
  | 'washing_staff'
  | 'qc_inspector'
  | 'inventory_manager'
  | 'viewer'

export type WipPhotoType = 'received' | 'inspection' | 'approval' | 'repair' | 'wash' | 'qc' | 'delivery' | 'damage' | 'other'

export interface DealerStaff {
  id: string
  service_center_id: string
  profile_id: string | null
  full_name: string
  phone: string
  email: string
  role: DealerStaffRole
  permissions: string[]
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WipTrackingRecord {
  id: string
  service_center_id: string
  dealer_dms_job_no: string
  dealer_dms_invoice_no: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  customer_whatsapp: string
  vehicle_id: string | null
  vehicle_registration_no: string
  vehicle_model: string
  odometer_km: number | null
  tracking_code: string
  tracking_code_hash?: string | null
  customer_tracking_path: string
  current_status: WipStatus
  status_detail: string
  approval_state: WipApprovalState
  technician_id: string | null
  assigned_technician_name: string
  promised_at: string | null
  received_at: string | null
  inspection_started_at: string | null
  inspection_completed_at: string | null
  approval_requested_at: string | null
  repair_started_at: string | null
  wash_started_at: string | null
  qc_started_at: string | null
  invoice_generated_at: string | null
  ready_at: string | null
  delivered_at: string | null
  closed_at: string | null
  notes: string
  internal_notes: string
  metadata: Record<string, unknown>
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface WipStatusHistory {
  id: string
  wip_tracking_record_id: string
  service_center_id: string
  status_from: WipStatus | null
  status_to: WipStatus
  status_detail: string
  event_type: 'record_created' | 'status_change' | 'technician_assigned' | 'approval_requested' | 'approval_response' | 'photo_added' | 'note_added' | 'notification_queued'
  actor_id: string | null
  actor_staff_id: string | null
  customer_visible: boolean
  note: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface WipApproval {
  id: string
  wip_tracking_record_id: string
  service_center_id: string
  approval_no: string
  title: string
  description: string
  estimate_amount: number
  status: WipApprovalStatus
  customer_response_note: string
  requested_by: string | null
  requested_at: string | null
  responded_at: string | null
  expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WipPhoto {
  id: string
  wip_tracking_record_id: string
  service_center_id: string
  uploaded_by: string | null
  photo_type: WipPhotoType
  photo_url: string
  caption: string
  customer_visible: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface TechnicianAssignment {
  id: string
  wip_tracking_record_id: string
  service_center_id: string
  technician_staff_id: string
  assigned_by: string | null
  status: 'active' | 'completed' | 'cancelled'
  assigned_at: string | null
  accepted_at: string | null
  completed_at: string | null
  notes: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateWipTrackingRecordInput {
  service_center_id: string
  dealer_dms_job_no: string
  customer_name: string
  customer_phone: string
  customer_whatsapp?: string
  customer_id?: string | null
  vehicle_id?: string | null
  vehicle_registration_no: string
  vehicle_model?: string
  odometer_km?: number | null
  promised_at?: string | null
  notes?: string
  metadata?: Record<string, unknown>
}

export interface AdvanceWipStatusInput {
  record_id: string
  next_status: WipStatus
  status_detail?: string
  note?: string
  customer_visible?: boolean
  dealer_dms_invoice_no?: string
}

export interface CreateWipApprovalInput {
  record_id: string
  title: string
  description?: string
  estimate_amount?: number
  expires_at?: string | null
}

export interface AssignWipTechnicianInput {
  record_id: string
  technician_staff_id: string
  notes?: string
}

export interface AddWipPhotoInput {
  record_id: string
  service_center_id: string
  photo_type: WipPhotoType
  photo_url: string
  caption?: string
  customer_visible?: boolean
}

export interface WipCustomerTrackingPayload {
  ok: boolean
  error?: string
  record?: Pick<
    WipTrackingRecord,
    | 'id'
    | 'dealer_dms_job_no'
    | 'dealer_dms_invoice_no'
    | 'customer_name'
    | 'vehicle_registration_no'
    | 'vehicle_model'
    | 'current_status'
    | 'status_detail'
    | 'approval_state'
    | 'promised_at'
    | 'received_at'
    | 'ready_at'
    | 'delivered_at'
    | 'closed_at'
  >
  service_center?: Record<string, unknown>
  history?: WipStatusHistory[]
  approvals?: WipApproval[]
  photos?: WipPhoto[]
}
