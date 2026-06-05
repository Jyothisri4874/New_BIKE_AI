export type UserRole = 'admin' | 'dealer' | 'customer' | 'crm' | 'service_manager'

export type DealerStatus = 'pending' | 'active' | 'suspended' | 'rejected'

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  phone: string
  avatar_url: string
  email: string
  role: UserRole
  preferred_center_id?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Dealer {
  id: string
  owner_id: string | null
  name: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  gst_number: string
  description: string
  logo_url: string
  status: DealerStatus
  rating: number
  total_reviews: number
  brands: string[]
  services: string[]
  open_time: string
  close_time: string
  lat: number
  lng: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Workshop taxonomy
  workshop_services?: Record<string, string[]>
  facilities?: string[]
  capability_tags?: string[]
  supported_oems?: string[]
  supported_segments?: string[]
  workshop_type?: string
  is_ev_capable?: boolean
  is_rsa_enabled?: boolean
  is_pickup_available?: boolean
  is_express_center?: boolean
}

export interface Booking {
  id: string
  user_id: string
  bike_id: string | null
  service_center_id: string
  oem_id: string | null
  model_id: string | null
  variant_id: string | null
  manufacturing_year: number | null
  fuel_type: string | null
  vehicle_number: string | null
  odometer_km: number | null
  service_type: string
  scheduled_date: string
  scheduled_time: string
  status: BookingStatus
  notes: string
  estimated_cost: number
  final_cost: number
  created_at: string
  updated_at: string
  profiles?: Profile
  service_centers?: Dealer
}

export * from './wip'
